const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function getPaymentStatuses(req, res) {
  try {
    const { start, end } = req.query;

    const filters = {};
    if (start && end) {
      filters.date = { gte: new Date(start), lte: new Date(end) };
    }

    const statuses = await prisma.paymentStatus.findMany({
      where: filters,
      select: { maidId: true, date: true, status: true },
      orderBy: { date: "asc" },
    });

    res.json(statuses);
  } catch (err) {
    console.error("Erro ao listar status de pagamento:", err);
    res.status(500).json({ error: "Erro ao listar status de pagamento" });
  }
}

async function upsertPaymentStatus(req, res) {
  try {
    const { maidId, date, status } = req.body;
    if (!maidId || !date || !status)
      return res.status(400).json({ error: "Campos obrigatórios ausentes" });

    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    const normalizedStatus = status.toUpperCase() === "PAGO" ? "PAGO" : "PENDENTE";

    const saved = await prisma.paymentStatus.upsert({
      where: { maidId_date: { maidId, date: parsedDate } },
      update: { status: normalizedStatus },
      create: { maidId, date: parsedDate, status: normalizedStatus },
    });

    res.json(saved);
  } catch (err) {
    console.error("Erro ao salvar status de pagamento:", err);
    res.status(500).json({ error: "Erro ao salvar status de pagamento" });
  }
}

module.exports = { getPaymentStatuses, upsertPaymentStatus };
