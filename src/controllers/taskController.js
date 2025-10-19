const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * GET /tasks/checkouts?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Retorna as tarefas de limpeza (checkouts) dentro de um intervalo.
 */
exports.getCheckouts = async (req, res) => {
  try {
    let { start, end } = req.query;

    // 🛠️ Validação segura das datas
    const startDate = start ? new Date(start) : new Date("2000-01-01");
    const endDate = end ? new Date(end) : new Date("2100-01-01");

    if (isNaN(startDate) || isNaN(endDate)) {
      return res.status(400).json({ error: "Datas inválidas." });
    }

    const tasks = await prisma.task.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: { maid: true },
      orderBy: { date: "asc" },
    });

    // ✅ Normaliza resposta para o front (Dashboard e Cleaning Schedule)
    const mapped = tasks.map((t) => ({
      id: t.id,
      date: t.date ? t.date.toISOString().split("T")[0] : null, // formato YYYY-MM-DD
      stay: t.stay || "Sem Stay", // string no schema
      rooms: t.rooms || "-", // string ou lista de quartos
      maid: t.maid ? t.maid.name : null,
      maidId: t.maid ? t.maid.id : null,
    }));

    res.json(mapped);
  } catch (err) {
    console.error("Erro em getCheckouts:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * PUT /tasks/:id/assign
 * Atribui ou remove uma diarista de uma tarefa.
 */
exports.assignMaid = async (req, res) => {
  const { id } = req.params;
  const { maidId } = req.body;

  try {
    console.log("Task ID recebido:", id);
    console.log("Maid ID recebido:", maidId);

    const updated = await prisma.task.update({
      where: { id },
      data: {
        maidId: maidId ? parseInt(maidId, 10) : null,
      },
      include: { maid: true },
    });

    res.json(updated);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Tarefa não encontrada" });
    }
    console.error("Erro em assignMaid:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE /tasks/:id
 * Remove uma task por ID (hard delete). Retorna 204 se OK.
 */
exports.deleteCheckoutTask = async (req, res) => {
  const { id } = req.params;

  try {
    console.log("🗑️ Deletando task checkout ID:", id);

    const deleted = await prisma.task.delete({
      where: { id },
    });

    console.log("✅ Task deletada:", deleted.id);
    return res.status(204).send();
  } catch (err) {
    console.error("Erro em deleteCheckoutTask:", err);

    // Se o registro não for encontrado (P2025)
    if (err?.code === "P2025") {
      return res.status(404).json({ error: "Tarefa não encontrada" });
    }

    return res.status(500).json({ error: "Erro interno no servidor" });
  }
};


/**
 * GET /tasks/monthly?month=YYYY-MM
 * Retorna todas as tarefas do mês informado.
 */
exports.getMonthly = async (req, res) => {
  const { month } = req.query; // ex: "2025-09"

  try {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: "Formato de mês inválido (use YYYY-MM)." });
    }

    const start = new Date(`${month}-01T00:00:00Z`);
    const end = new Date(new Date(start).setMonth(start.getMonth() + 1));

    const tasks = await prisma.task.findMany({
      where: {
        date: {
          gte: start,
          lt: end,
        },
      },
      include: { maid: true },
      orderBy: { date: "asc" },
    });

    res.json(tasks);
  } catch (err) {
    console.error("Erro em getMonthly:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /tasks/debug
 * Lista todas as tarefas de limpeza (modo diagnóstico).
 */
exports.getAllTasksDebug = async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      include: { maid: true },
      orderBy: { date: "asc" },
    });
    res.json(tasks);
  } catch (err) {
    console.error("Erro em getAllTasksDebug:", err);
    res.status(500).json({ error: "Erro ao buscar todas as tasks." });
  }
};
