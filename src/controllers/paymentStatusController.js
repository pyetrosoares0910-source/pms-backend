const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function getPaymentStatuses(req, res) {
  try {
    const { start, end } = req.query;

    const filters = {};
    if (start && end) {
      filters.date = {
        gte: new Date(`${start}T00:00:00Z`),
        lte: new Date(`${end}T23:59:59Z`),
      };
    }

    const statuses = await prisma.paymentStatus.findMany({
      where: filters,
      select: {
        maidId: true,
        date: true,
        status: true,
      },
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
    let { maidId, date, status } = req.body;
    if (!maidId || !date || !status)
      return res.status(400).json({ error: "Campos obrigatórios ausentes" });

    // 🧠 força tipo string
    maidId = String(maidId);

    // normaliza data e status
    const parsedDate = new Date(`${date}T00:00:00Z`);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: "Data inválida" });
    }

    const normalizedStatus = status.toUpperCase() === "PAGO" ? "PAGO" : "PENDENTE";

    const saved = await prisma.paymentStatus.upsert({
      where: {
        maidId_date: {
          maidId,
          date: parsedDate,
        },
      },
      update: { status: normalizedStatus },
      create: { maidId, date: parsedDate, status: normalizedStatus },
    });

    res.json(saved);
  } catch (err) {
    console.error("❌ Erro ao salvar status de pagamento:", err);
    res.status(500).json({
      error: "Erro ao salvar status de pagamento",
      detail: err.message,
    });
  }
}



module.exports = { getPaymentStatuses, upsertPaymentStatus };
