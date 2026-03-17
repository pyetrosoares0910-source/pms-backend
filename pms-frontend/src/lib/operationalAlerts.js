import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

function hasAssignedMaid(task) {
  return Boolean(task?.maidId || String(task?.maid || "").trim());
}

export function mapCheckoutTask(task) {
  return {
    id: task.id,
    date: dayjs.utc(task.date || task.checkoutDate).format("YYYY-MM-DD"),
    stay: task.stay || "Sem Stay",
    rooms: task.rooms || "Sem identificacao",
    maid: task.maid || null,
    maidId: task.maidId || null,
  };
}

export function getCheckinAlertSummary(reservations, baseDate = dayjs()) {
  const referenceDate = dayjs(baseDate).startOf("day");
  const todayCheckins = (reservations || []).filter((reservation) => {
    const status = String(reservation.status || "").toLowerCase();
    return (
      status !== "cancelada" &&
      reservation.checkinDate &&
      dayjs.utc(reservation.checkinDate).isSame(referenceDate, "day")
    );
  });

  const pending = todayCheckins.filter((reservation) => {
    const status = String(reservation.status || "").toLowerCase();
    return status !== "ativa" && status !== "concluida" && status !== "cancelada";
  }).length;

  return {
    total: todayCheckins.length,
    pending,
    finished: todayCheckins.length - pending,
  };
}

export function buildCheckinAlert(summary, targetLabel = "hoje") {
  if (summary.pending > 0) {
    return {
      isPending: true,
      message: `Alerta: ${summary.pending} de ${summary.total} check-in(s) de ${targetLabel} ainda pendente(s).`,
    };
  }

  if (summary.total > 0) {
    return {
      isPending: false,
      message: `Tudo certo: ${summary.finished} de ${summary.total} check-in(s) de ${targetLabel} ja foram feitos.`,
    };
  }

  return {
    isPending: false,
    message: `Tudo certo: nao ha check-ins previstos para ${targetLabel}.`,
  };
}

export function getCleaningCoverageSummary(tasks, baseDate = dayjs()) {
  const startDate = dayjs(baseDate).startOf("week").startOf("day");
  const endDate = dayjs(baseDate).endOf("week").endOf("day");
  const weeklyTasks = (tasks || []).filter((task) => {
    if (!task?.date) return false;
    const taskDate = dayjs(task.date);
    return taskDate.isBetween(startDate, endDate, "day", "[]");
  });
  const unassignedTasks = weeklyTasks.filter((task) => !hasAssignedMaid(task));

  return {
    startDate: startDate.format("YYYY-MM-DD"),
    endDate: endDate.format("YYYY-MM-DD"),
    total: weeklyTasks.length,
    assigned: weeklyTasks.length - unassignedTasks.length,
    unassigned: unassignedTasks.length,
    unassignedDays: new Set(unassignedTasks.map((task) => dayjs(task.date).format("YYYY-MM-DD")))
      .size,
  };
}

export function buildCleaningCoverageAlert(summary, targetLabel = "na semana atual") {
  if (summary.unassigned > 0) {
    return {
      isPending: true,
      message: `Alerta: ${summary.unassigned} checkout(s) ${summary.unassignedDays > 0 ? `em ${summary.unassignedDays} dia(s) ` : ""}ainda sem diarista designada ${targetLabel}.`,
    };
  }

  if (summary.total > 0) {
    return {
      isPending: false,
      message: `Tudo certo: ${summary.assigned} checkout(s) da limpeza ${targetLabel} ja possuem diarista designada.`,
    };
  }

  return {
    isPending: false,
    message: `Tudo certo: nao ha checkouts de limpeza previstos ${targetLabel}.`,
  };
}
