const { evaluatePeriodicTaskAssignment } = require("./periodicTaskRules");
const { toUtcDay } = require("./periodicTaskSchedule");

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toDateKey(value) {
  const date = toUtcDay(value);
  return date ? date.toISOString().split("T")[0] : null;
}

function makeRoomLookup(rooms) {
  const byStayAndTitle = new Map();
  const byTitle = new Map();

  rooms.forEach((room) => {
    const titleKey = normalizeText(room.title);
    const stayKey = normalizeText(room.stay?.name);

    byStayAndTitle.set(`${stayKey}|${titleKey}`, room);
    if (!byTitle.has(titleKey)) byTitle.set(titleKey, []);
    byTitle.get(titleKey).push(room);
  });

  return { byStayAndTitle, byTitle };
}

function findRoomForCheckoutTask(task, roomLookup) {
  const titleKey = normalizeText(task.rooms);
  const stayKey = normalizeText(task.stay);

  return (
    roomLookup.byStayAndTitle.get(`${stayKey}|${titleKey}`) ||
    roomLookup.byTitle.get(titleKey)?.[0] ||
    null
  );
}

function buildMaidLoadByDay(tasks) {
  const load = new Map();

  tasks.forEach((task) => {
    if (!task.maidId) return;
    const key = `${toDateKey(task.date)}|${task.maidId}`;
    load.set(key, (load.get(key) || 0) + 1);
  });

  return load;
}

function isReminderActiveForDate(reminder, date) {
  const day = toUtcDay(date);
  const startsAt = reminder.startsAt ? toUtcDay(reminder.startsAt) : null;
  const endsAt = reminder.endsAt ? toUtcDay(reminder.endsAt) : null;

  if (!day) return false;
  if (startsAt && startsAt > day) return false;
  if (endsAt && endsAt < day) return false;
  return true;
}

async function composeCleaningOperations({ prisma, tasks, startDate, endDate }) {
  if (tasks.length === 0) return [];

  const rooms = await prisma.room.findMany({
    include: { stay: true },
  });
  const roomLookup = makeRoomLookup(rooms);
  const loadByDay = buildMaidLoadByDay(tasks);
  const endDay = toUtcDay(endDate);

  const periodicTasks = await prisma.periodicTask.findMany({
    where: {
      active: true,
      nextExecutionDate: { lte: endDay },
    },
    include: {
      room: { include: { stay: true } },
      executions: {
        where: {
          executionDate: {
            gte: toUtcDay(startDate),
            lte: endDay,
          },
        },
      },
    },
    orderBy: [{ nextExecutionDate: "asc" }, { name: "asc" }],
  });

  const reminders = await prisma.operationalReminder.findMany({
    where: {
      active: true,
      OR: [{ startsAt: null }, { startsAt: { lte: endDay } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: toUtcDay(startDate) } }] }],
    },
    include: { stay: true },
    orderBy: [{ stayId: "asc" }, { title: "asc" }],
  });

  const periodicByRoomId = new Map();
  periodicTasks.forEach((task) => {
    if (!periodicByRoomId.has(task.roomId)) periodicByRoomId.set(task.roomId, []);
    periodicByRoomId.get(task.roomId).push(task);
  });

  const remindersByStayId = new Map();
  reminders.forEach((reminder) => {
    if (!remindersByStayId.has(reminder.stayId)) remindersByStayId.set(reminder.stayId, []);
    remindersByStayId.get(reminder.stayId).push(reminder);
  });

  return tasks.map((task) => {
    const room = findRoomForCheckoutTask(task, roomLookup);
    const taskDateKey = toDateKey(task.date);
    const maidDailyLoad = task.maidId ? loadByDay.get(`${taskDateKey}|${task.maidId}`) || 0 : 0;

    const periodicTaskCandidates = room ? periodicByRoomId.get(room.id) || [] : [];
    const periodicTaskAssignments = periodicTaskCandidates
      .filter((periodicTask) => {
        const nextDate = toUtcDay(periodicTask.nextExecutionDate);
        const checkoutDate = toUtcDay(task.date);
        const executionForDay = periodicTask.executions.find(
          (execution) => toDateKey(execution.executionDate) === taskDateKey
        );

        return nextDate <= checkoutDate && executionForDay?.status !== "COMPLETED";
      })
      .map((periodicTask) => {
        const evaluation = evaluatePeriodicTaskAssignment({
          checkoutTask: task,
          periodicTask,
          maidDailyLoad,
          date: task.date,
          room,
        });

        return {
          id: periodicTask.id,
          name: periodicTask.name,
          description: periodicTask.description,
          frequency: periodicTask.frequency,
          lastExecutionDate: periodicTask.lastExecutionDate,
          nextExecutionDate: periodicTask.nextExecutionDate,
          roomId: periodicTask.roomId,
          allowed: evaluation.allowed,
          blockedBy: evaluation.blockedBy,
        };
      });

    const operationalReminders = room?.stayId
      ? (remindersByStayId.get(room.stayId) || [])
          .filter((reminder) => isReminderActiveForDate(reminder, task.date))
          .map((reminder) => ({
            id: reminder.id,
            stayId: reminder.stayId,
            stay: reminder.stay?.name || null,
            title: reminder.title,
            message: reminder.message,
          }))
      : [];

    return {
      ...task,
      roomId: room?.id || null,
      stayId: room?.stayId || null,
      periodicTasks: periodicTaskAssignments,
      operationalReminders,
    };
  });
}

module.exports = {
  composeCleaningOperations,
  normalizeText,
  toDateKey,
};
