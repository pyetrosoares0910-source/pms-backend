import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

function getDueDay(task) {
  return task?.dueDate ? dayjs.utc(task.dueDate).startOf("day") : null;
}

function isTaskCompleted(task) {
  return String(task?.status || "").toLowerCase() === "concluido";
}

function isOperationalTask(task) {
  return !task?.isRecurring;
}

function isTaskActive(task) {
  return isOperationalTask(task) && !isTaskCompleted(task);
}

function isTaskOverdue(task, referenceDate) {
  const due = getDueDay(task);
  return isTaskActive(task) && Boolean(due) && due.isBefore(referenceDate, "day");
}

function isTaskDueToday(task, referenceDate) {
  const due = getDueDay(task);
  return isTaskActive(task) && Boolean(due) && due.isSame(referenceDate, "day");
}

function isTaskDueWithinDays(task, referenceDate, days) {
  const due = getDueDay(task);
  if (!isTaskActive(task) || !due) return false;
  return !due.isBefore(referenceDate, "day") && !due.isAfter(referenceDate.add(days, "day"), "day");
}

export function getMaintenanceAlertSummary(tasks, referenceDate = dayjs()) {
  const reference = dayjs(referenceDate).startOf("day");
  const operationalTasks = (tasks || []).filter((task) => isOperationalTask(task));
  const activeTasks = operationalTasks.filter((task) => isTaskActive(task));

  return {
    total: operationalTasks.length,
    active: activeTasks.length,
    overdue: activeTasks.filter((task) => isTaskOverdue(task, reference)).length,
    dueToday: activeTasks.filter((task) => isTaskDueToday(task, reference)).length,
    next7: activeTasks.filter(
      (task) =>
        !isTaskDueToday(task, reference) &&
        Boolean(task.dueDate) &&
        isTaskDueWithinDays(task, reference, 7)
    ).length,
    unscheduled: activeTasks.filter((task) => !task.dueDate).length,
    completed: operationalTasks.filter((task) => isTaskCompleted(task)).length,
  };
}

export function buildMaintenanceAlert(summary) {
  if (summary.overdue > 0) {
    return {
      isPending: true,
      message: `Alerta: ${summary.overdue} atividade(s) atrasada(s) exigem atencao. ${summary.active} atividade(s) seguem em aberto.`,
    };
  }

  if (summary.active > 0) {
    return {
      isPending: false,
      message: `Tudo certo: nenhuma atividade atrasada. ${summary.dueToday} vence(m) hoje, ${summary.next7} vence(m) nos proximos 7 dias e ${summary.unscheduled} segue(m) sem prazo.`,
    };
  }

  return {
    isPending: false,
    message: "Tudo certo: nao ha atividades ativas no momento.",
  };
}
