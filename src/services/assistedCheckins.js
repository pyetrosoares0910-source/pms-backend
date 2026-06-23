const ASSISTED_CHECKIN_REQUIRED_CODE = "ASSISTED_CHECKIN_REQUIRED";

function getAssistedCheckinStatus(assistedCheckin) {
  if (!assistedCheckin) return "pendente";
  if (assistedCheckin.keyDeliveryConfirmedAt) return "concluido";
  if (isAssistedCheckinReadyForActivation(assistedCheckin)) {
    return "pronto_para_entrega";
  }
  if (
    assistedCheckin.scheduledArrivalAt ||
    assistedCheckin.rulesMessageSentAt ||
    assistedCheckin.documentsReceivedAt ||
    assistedCheckin.notes
  ) {
    return "em_andamento";
  }
  return "pendente";
}

function isAssistedCheckinComplete(assistedCheckin) {
  return Boolean(assistedCheckin?.keyDeliveryConfirmedAt);
}

function isAssistedCheckinReadyForActivation(assistedCheckin) {
  return Boolean(
    assistedCheckin?.scheduledArrivalAt &&
      assistedCheckin?.rulesMessageSentAt &&
      assistedCheckin?.documentsReceivedAt
  );
}

function withAssistedCheckinStatus(assistedCheckin) {
  if (!assistedCheckin) return null;
  return {
    ...assistedCheckin,
    status: getAssistedCheckinStatus(assistedCheckin),
    complete: isAssistedCheckinComplete(assistedCheckin),
    readyForActivation: isAssistedCheckinReadyForActivation(assistedCheckin),
  };
}

function withReservationAssistedStatus(reservation) {
  if (!reservation) return reservation;
  return {
    ...reservation,
    assistedCheckin: withAssistedCheckinStatus(reservation.assistedCheckin),
  };
}

function toNullableDate(value) {
  if (value === null || value === "") return null;
  if (typeof value === "undefined") return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function normalizeAssistedCheckinPayload(payload = {}) {
  const data = {};

  [
    "scheduledArrivalAt",
    "rulesMessageSentAt",
    "documentsReceivedAt",
    "keyDeliveryConfirmedAt",
  ].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = toNullableDate(payload[field]);
    }
  });

  if (Object.prototype.hasOwnProperty.call(payload, "notes")) {
    const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
    data.notes = notes || null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "rulesMessageText")) {
    const rulesMessageText =
      typeof payload.rulesMessageText === "string" ? payload.rulesMessageText.trim() : "";
    data.rulesMessageText = rulesMessageText || null;
  }

  return data;
}

module.exports = {
  ASSISTED_CHECKIN_REQUIRED_CODE,
  getAssistedCheckinStatus,
  isAssistedCheckinComplete,
  isAssistedCheckinReadyForActivation,
  normalizeAssistedCheckinPayload,
  withAssistedCheckinStatus,
  withReservationAssistedStatus,
};
