const { PrismaClient } = require("@prisma/client");
const {
  normalizeAssistedCheckinPayload,
  withAssistedCheckinStatus,
  withReservationAssistedStatus,
} = require("../services/assistedCheckins");

const prisma = new PrismaClient();

function toValidDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function buildDateWhere(query) {
  const now = new Date();
  const from = toValidDate(query.from) || addDays(now, -7);
  const to = toValidDate(query.to) || addDays(now, 45);
  return {
    gte: new Date(`${from.toISOString().slice(0, 10)}T00:00:00.000Z`),
    lte: new Date(`${to.toISOString().slice(0, 10)}T23:59:59.999Z`),
  };
}

async function listAssistedCheckins(req, res) {
  try {
    const reservations = await prisma.reservation.findMany({
      where: {
        status: { not: "cancelada" },
        checkinDate: buildDateWhere(req.query),
        room: {
          selfCheckinEnabled: false,
        },
      },
      include: {
        room: { include: { stay: true } },
        guest: true,
        assistedCheckin: true,
      },
      orderBy: [{ checkinDate: "asc" }, { createdAt: "asc" }],
    });

    return res.json(reservations.map(withReservationAssistedStatus));
  } catch (error) {
    console.error("Erro ao listar check-ins presenciais:", error);
    return res.status(500).json({ error: "Erro ao listar check-ins presenciais." });
  }
}

async function getAssistedCheckin(req, res) {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: String(req.params.reservationId) },
      include: {
        room: { include: { stay: true } },
        guest: true,
        assistedCheckin: true,
      },
    });

    if (!reservation) {
      return res.status(404).json({ error: "Reserva nao encontrada." });
    }

    return res.json(withReservationAssistedStatus(reservation));
  } catch (error) {
    console.error("Erro ao buscar check-in presencial:", error);
    return res.status(500).json({ error: "Erro ao buscar check-in presencial." });
  }
}

async function upsertAssistedCheckin(req, res) {
  try {
    const reservationId = String(req.params.reservationId);
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { room: { include: { stay: true } }, guest: true },
    });

    if (!reservation) {
      return res.status(404).json({ error: "Reserva nao encontrada." });
    }

    if (reservation.room?.selfCheckinEnabled !== false) {
      return res.status(400).json({
        error: "Esta reserva pertence a uma unidade com self-check-in habilitado.",
      });
    }

    const data = normalizeAssistedCheckinPayload(req.body);
    const invalidFields = Object.entries(data)
      .filter(([field, value]) => field !== "notes" && typeof value === "undefined")
      .map(([field]) => field);

    if (invalidFields.length > 0) {
      return res.status(400).json({
        error: "Data invalida no check-in presencial.",
        details: { invalidFields },
      });
    }

    const assistedCheckin = await prisma.assistedCheckin.upsert({
      where: { reservationId },
      create: {
        reservationId,
        ...data,
      },
      update: data,
    });

    return res.json(withAssistedCheckinStatus(assistedCheckin));
  } catch (error) {
    console.error("Erro ao salvar check-in presencial:", error);
    return res.status(500).json({ error: "Erro ao salvar check-in presencial." });
  }
}

module.exports = {
  getAssistedCheckin,
  listAssistedCheckins,
  upsertAssistedCheckin,
};
