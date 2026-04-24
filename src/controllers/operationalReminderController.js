const { prisma } = require("../prisma");
const { toUtcDay } = require("../services/periodicTaskSchedule");

function parseOptionalDate(value) {
  if (!value) return null;
  const date = toUtcDay(value);
  if (!date) {
    const err = new Error("Data invalida.");
    err.status = 400;
    throw err;
  }
  return date;
}

function normalizeReminderInput(body, current = {}) {
  return {
    stayId: body.stayId ?? current.stayId,
    title: body.title ?? current.title,
    message: body.message ?? current.message,
    active: body.active === undefined ? current.active ?? true : Boolean(body.active),
    startsAt: body.startsAt === undefined ? current.startsAt ?? null : parseOptionalDate(body.startsAt),
    endsAt: body.endsAt === undefined ? current.endsAt ?? null : parseOptionalDate(body.endsAt),
  };
}

exports.list = async (req, res) => {
  try {
    const where = {};
    if (req.query.stayId) where.stayId = req.query.stayId;
    if (req.query.active !== undefined) where.active = req.query.active === "true";

    const reminders = await prisma.operationalReminder.findMany({
      where,
      include: { stay: true },
      orderBy: [{ active: "desc" }, { title: "asc" }],
    });

    res.json(reminders);
  } catch (err) {
    console.error("Erro ao listar lembretes operacionais:", err);
    res.status(500).json({ error: "Erro ao listar lembretes operacionais." });
  }
};

exports.create = async (req, res) => {
  try {
    if (!req.body.stayId || !req.body.title || !req.body.message) {
      return res.status(400).json({ error: "stayId, title e message sao obrigatorios." });
    }

    const reminder = await prisma.operationalReminder.create({
      data: normalizeReminderInput(req.body),
      include: { stay: true },
    });

    res.status(201).json(reminder);
  } catch (err) {
    console.error("Erro ao criar lembrete operacional:", err);
    res.status(err.status || 500).json({ error: err.message || "Erro ao criar lembrete operacional." });
  }
};

exports.update = async (req, res) => {
  try {
    const current = await prisma.operationalReminder.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: "Lembrete operacional nao encontrado." });

    const reminder = await prisma.operationalReminder.update({
      where: { id: req.params.id },
      data: normalizeReminderInput(req.body, current),
      include: { stay: true },
    });

    res.json(reminder);
  } catch (err) {
    console.error("Erro ao atualizar lembrete operacional:", err);
    res.status(err.status || 500).json({ error: err.message || "Erro ao atualizar lembrete operacional." });
  }
};

exports.remove = async (req, res) => {
  try {
    await prisma.operationalReminder.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Lembrete operacional nao encontrado." });
    }
    console.error("Erro ao remover lembrete operacional:", err);
    res.status(500).json({ error: "Erro ao remover lembrete operacional." });
  }
};
