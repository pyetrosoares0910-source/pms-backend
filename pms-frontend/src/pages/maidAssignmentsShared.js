import dayjs from "dayjs";

export const MAID_ASSIGNMENTS_SETTINGS_KEY = "maid-assignments-settings-v1";
export const MAID_ASSIGNMENTS_SETTINGS_EVENT = "maid-assignments-settings-changed";

export const defaultMaidAssignmentsSettings = {
  defaults: {
    checkoutTime: "10h",
    checkinTime: "16h",
  },
  stays: {},
  tasks: {},
  listDeliveryStatus: {},
};

export function makeMaidListDeliveryKey(date, maidName) {
  return [date, maidName || "sem-diarista"].join("|");
}

export function getStoredMaidAssignmentsSettings() {
  if (typeof localStorage === "undefined") {
    return defaultMaidAssignmentsSettings;
  }

  try {
    const raw = localStorage.getItem(MAID_ASSIGNMENTS_SETTINGS_KEY);
    if (!raw) return defaultMaidAssignmentsSettings;

    const parsed = JSON.parse(raw);
    return {
      defaults: {
        ...defaultMaidAssignmentsSettings.defaults,
        ...(parsed.defaults || {}),
      },
      stays: parsed.stays || {},
      tasks: parsed.tasks || {},
      listDeliveryStatus: parsed.listDeliveryStatus || {},
    };
  } catch {
    return defaultMaidAssignmentsSettings;
  }
}

export function saveMaidAssignmentsSettings(next) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(MAID_ASSIGNMENTS_SETTINGS_KEY, JSON.stringify(next));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(MAID_ASSIGNMENTS_SETTINGS_EVENT));
  }
}

export function getMaidListDeliverySummary(tasks, date, settings = getStoredMaidAssignmentsSettings()) {
  const normalizedDate = dayjs(date).format("YYYY-MM-DD");
  const maidNames = [
    ...new Set(
      (tasks || [])
        .filter(
          (task) => dayjs(task.date).format("YYYY-MM-DD") === normalizedDate && task.maid
        )
        .map((task) => task.maid)
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const total = maidNames.length;
  const sent = maidNames.filter((maidName) =>
    Boolean(settings.listDeliveryStatus[makeMaidListDeliveryKey(normalizedDate, maidName)])
  ).length;

  return {
    date: normalizedDate,
    maidNames,
    total,
    sent,
    pending: total - sent,
  };
}

export function buildMaidListAlert(summary, targetLabel) {
  if (summary.pending > 0) {
    return {
      isPending: true,
      message: `Alerta: ${summary.pending} de ${summary.total} listagem(oes) de diarista(s) ainda pendente(s) para ${targetLabel}.`,
    };
  }

  if (summary.total > 0) {
    return {
      isPending: false,
      message: `Tudo certo: ${summary.sent} de ${summary.total} listagem(oes) de diaristas de ${targetLabel} ja foram enviadas.`,
    };
  }

  return {
    isPending: false,
    message: `Tudo certo: nao ha listagens de diaristas previstas para ${targetLabel}.`,
  };
}
