const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Função auxiliar para gerar código MT-2025-0001
async function generateMaintenanceCode() {
  const total = await prisma.maintenanceTask.count();
  const year = new Date().getFullYear();
  return `MT-${year}-${String(total + 1).padStart(4, "0")}`;
}

// GET - listar tarefas
router.get("/", async (req, res) => {
  try {
    const { status, type, stayId } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (stayId) filters.stayId = stayId;

    const tasks = await prisma.maintenanceTask.findMany({
      where: filters,
      include: { stay: true, room: true },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    });

    res.json(tasks);
  } catch (err) {
    console.error("Erro ao listar tarefas de manutenção:", err);
    res.status(500).json({ error: "Erro ao listar tarefas de manutenção." });
  }
});

// POST - criar nova tarefa
router.post("/", async (req, res) => {
  try {
    const { title, description, stayId, roomId, responsible, status, type, dueDate } = req.body;

    const code = await generateMaintenanceCode();

    const task = await prisma.maintenanceTask.create({
      data: {
        code,
        title,
        description: description || null,
        stayId: stayId || null,
        roomId: roomId || null,
        responsible: responsible || null,
        status: status || "pendente",
        type: type || "corretiva",
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: { stay: true, room: true },
    });

    res.status(201).json(task);
  } catch (err) {
    console.error("Erro ao criar tarefa de manutenção:", err);
    res.status(500).json({ error: "Erro ao criar tarefa de manutenção." });
  }
});

// PUT - atualizar tarefa
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, stayId, roomId, responsible, status, type, dueDate } = req.body;

    const updated = await prisma.maintenanceTask.update({
      where: { id: String(id) },
      data: {
        title,
        description,
        stayId,
        roomId,
        responsible,
        status,
        type,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: { stay: true, room: true },
    });

    res.json(updated);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Tarefa não encontrada." });
    }
    console.error("Erro ao atualizar tarefa de manutenção:", err);
    res.status(500).json({ error: "Erro ao atualizar tarefa de manutenção." });
  }
});

// DELETE - remover tarefa
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.maintenanceTask.delete({ where: { id: String(id) } });
    res.json({ message: "Tarefa removida com sucesso." });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Tarefa não encontrada." });
    }
    console.error("Erro ao deletar tarefa de manutenção:", err);
    res.status(500).json({ error: "Erro ao deletar tarefa de manutenção." });
  }
});

module.exports = router;
