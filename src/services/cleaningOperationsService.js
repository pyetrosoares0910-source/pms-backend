const { evaluatePeriodicTaskAssignment } = require("./periodicTaskRules");
const { getExecutionWindow, toUtcDay } = require("./periodicTaskSchedule");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

function getDaysBetween(dateA, dateB) {
  const start = toUtcDay(dateA);
  const end = toUtcDay(dateB);
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
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

function findBestCheckoutForPeriodicTask({ periodicTask, checkoutTasksByRoomId, rangeEndDate }) {
  const window = getExecutionWindow(periodicTask);
  const checkoutTasks = checkoutTasksByRoomId.get(periodicTask.roomId) || [];
  const completedExecutions = new Set(
    (periodicTask.executions || [])
      .filter((execution) => execution.status === "COMPLETED")
      .map((execution) => toDateKey(execution.executionDate))
  );

  const availableCheckouts = checkoutTasks.filter(
    (checkoutTask) => !completedExecutions.has(toDateKey(checkoutTask.date))
  );

  const windowCandidates = availableCheckouts.filter((checkoutTask) => {
    const checkoutDate = toUtcDay(checkoutTask.date);
    return checkoutDate >= window.earliestDate && checkoutDate <= window.latestDate;
  });

  if (windowCandidates.length > 0) {
    return {
      checkoutTask: windowCandidates.sort((a, b) => {
        const diffA = Math.abs(toUtcDay(a.date).getTime() - window.targetDate.getTime());
        const diffB = Math.abs(toUtcDay(b.date).getTime() - window.targetDate.getTime());
        if (diffA !== diffB) return diffA - diffB;
        return toUtcDay(a.date) - toUtcDay(b.date);
      })[0],
      window,
      urgent: false,
    };
  }

  const overdueCandidates = availableCheckouts.filter((checkoutTask) => {
    const checkoutDate = toUtcDay(checkoutTask.date);
    return checkoutDate > window.latestDate && checkoutDate <= rangeEndDate;
  });

  if (overdueCandidates.length > 0) {
    return {
      checkoutTask: overdueCandidates.sort((a, b) => toUtcDay(a.date) - toUtcDay(b.date))[0],
      window,
      urgent: true,
    };
  }

  return { checkoutTask: null, window, urgent: false };
}

async function persistScheduledExecutions({ prisma, assignments }) {
  await Promise.all(
    assignments.map(({ periodicTask, checkoutTask }) =>
      prisma.periodicTaskExecution.deleteMany({
        where: {
          taskId: periodicTask.id,
          roomId: periodicTask.roomId,
          status: "SCHEDULED",
          executionDate: { not: toUtcDay(checkoutTask.date) },
        },
      })
    )
  );

  await Promise.all(
    assignments.map(({ periodicTask, checkoutTask }) =>
      prisma.periodicTaskExecution.upsert({
        where: {
          taskId_roomId_executionDate: {
            taskId: periodicTask.id,
            roomId: periodicTask.roomId,
            executionDate: toUtcDay(checkoutTask.date),
          },
        },
        create: {
          taskId: periodicTask.id,
          roomId: periodicTask.roomId,
          assignedToId: checkoutTask.maidId || null,
          executionDate: toUtcDay(checkoutTask.date),
          status: "SCHEDULED",
        },
        update: {
          assignedToId: checkoutTask.maidId || null,
        },
      })
    )
  );
}

async function composeCleaningOperations({ prisma, tasks, startDate, endDate }) {
  if (tasks.length === 0) return [];

  const rooms = await prisma.room.findMany({
    include: { stay: true },
  });
  const roomLookup = makeRoomLookup(rooms);
  const loadByDay = buildMaidLoadByDay(tasks);
  const startDay = toUtcDay(startDate);
  const endDay = toUtcDay(endDate);

  const periodicTasks = await prisma.periodicTask.findMany({
    where: {
      active: true,
    },
    include: {
      room: { include: { stay: true } },
      executions: {
        where: { status: { in: ["SCHEDULED", "COMPLETED"] } },
      },
    },
    orderBy: [{ nextExecutionDate: "asc" }, { name: "asc" }],
  });

  const executionWindows = periodicTasks.map((periodicTask) => ({
    periodicTask,
    window: getExecutionWindow(periodicTask),
  }));

  const planningStart = executionWindows.reduce(
    (minDate, item) => (item.window.earliestDate < minDate ? item.window.earliestDate : minDate),
    startDay
  );
  const planningEnd = executionWindows.reduce(
    (maxDate, item) => (item.window.latestDate > maxDate ? item.window.latestDate : maxDate),
    endDay
  );

  const planningTasks = await prisma.task.findMany({
    where: {
      date: {
        gte: planningStart,
        lte: planningEnd > endDay ? planningEnd : endDay,
      },
    },
    include: { maid: true },
    orderBy: { date: "asc" },
  });

  const checkoutTasksByRoomId = new Map();
  planningTasks.forEach((checkoutTask) => {
    const room = findRoomForCheckoutTask(checkoutTask, roomLookup);
    if (!room) return;
    const enrichedTask = { ...checkoutTask, roomId: room.id, stayId: room.stayId };
    if (!checkoutTasksByRoomId.has(room.id)) checkoutTasksByRoomId.set(room.id, []);
    checkoutTasksByRoomId.get(room.id).push(enrichedTask);
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

  const selectedAssignmentsByCheckoutId = new Map();
  const selectedAssignments = [];
  periodicTasks.forEach((periodicTask) => {
    const existingScheduledExecution = (periodicTask.executions || []).find(
      (execution) => execution.status === "SCHEDULED"
    );
    const existingCheckoutTask = existingScheduledExecution
      ? (checkoutTasksByRoomId.get(periodicTask.roomId) || []).find(
          (checkoutTask) =>
            toDateKey(checkoutTask.date) === toDateKey(existingScheduledExecution.executionDate)
        )
      : null;

    if (existingCheckoutTask) {
      const window = getExecutionWindow(periodicTask);
      const checkoutDate = toUtcDay(existingCheckoutTask.date);
      const assignment = {
        periodicTask,
        checkoutTask: existingCheckoutTask,
        window,
        urgent: checkoutDate > window.latestDate,
      };
      selectedAssignments.push(assignment);
      if (!selectedAssignmentsByCheckoutId.has(existingCheckoutTask.id)) {
        selectedAssignmentsByCheckoutId.set(existingCheckoutTask.id, []);
      }
      selectedAssignmentsByCheckoutId.get(existingCheckoutTask.id).push(assignment);
      return;
    }

    const selection = findBestCheckoutForPeriodicTask({
      periodicTask,
      checkoutTasksByRoomId,
      rangeEndDate: planningEnd > endDay ? planningEnd : endDay,
    });

    if (!selection.checkoutTask) return;
    const assignment = { periodicTask, ...selection };
    selectedAssignments.push(assignment);
    if (!selectedAssignmentsByCheckoutId.has(selection.checkoutTask.id)) {
      selectedAssignmentsByCheckoutId.set(selection.checkoutTask.id, []);
    }
    selectedAssignmentsByCheckoutId.get(selection.checkoutTask.id).push(assignment);
  });

  await persistScheduledExecutions({ prisma, assignments: selectedAssignments });

  const remindersByStayId = new Map();
  reminders.forEach((reminder) => {
    if (!remindersByStayId.has(reminder.stayId)) remindersByStayId.set(reminder.stayId, []);
    remindersByStayId.get(reminder.stayId).push(reminder);
  });

  return tasks.map((task) => {
    const room = findRoomForCheckoutTask(task, roomLookup);
    const taskDateKey = toDateKey(task.date);
    const maidDailyLoad = task.maidId ? loadByDay.get(`${taskDateKey}|${task.maidId}`) || 0 : 0;

    const periodicTaskCandidates = selectedAssignmentsByCheckoutId.get(task.id) || [];
    const periodicTaskAssignments = periodicTaskCandidates
      .map(({ periodicTask, window, urgent }) => {
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
          scheduledDate: task.date,
          earliestExecutionDate: window.earliestDate,
          latestExecutionDate: window.latestDate,
          daysSinceLastExecution: periodicTask.lastExecutionDate
            ? getDaysBetween(periodicTask.lastExecutionDate, task.date)
            : null,
          urgent,
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
  findRoomForCheckoutTask,
  makeRoomLookup,
  normalizeText,
  toDateKey,
};
