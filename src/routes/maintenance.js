const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { generateOccurrences } = require("../utils/recurrence");

// 🔢 Função auxiliar para gerar código unico
async function generateMaintenanceCode() {
  const year = new Date().getFullYear();
  const stamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000); 
  return `MT-${year}-${stamp}-${random}`;
}

/* ============================================================
   GET - listar tarefas
   (mantido igual, com filtros opcionais)
============================================================ */
router.get("/", async (req, res) => {
  try {
    const { status, type, stayId, includeModels } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (type) filters.type = type;
    if (stayId) filters.stayId = stayId;

    // por padrão, não mostra modelos de recorrência
    if (!includeModels) {
      filters.OR = [{ isRecurring: false }, { parentId: { not: null } }];
    }

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

/* ============================================================
   POST - criar nova tarefa (avulsa ou recorrente)
============================================================ */
router.post("/", async (req, res) => {
  try {
    const {
      title,
      description,
      stayId,
      roomId,
      responsible,
      status,
      type,
      dueDate,
      isRecurring,
      recurrence,
      timezone = "America/Sao_Paulo",
    } = req.body;

    // 🧩 CASO 1: tarefa recorrente
    if (isRecurring && recurrence) {
      // 1️⃣ cria o modelo
      const parent = await prisma.maintenanceTask.create({
        data: {
          code: await generateMaintenanceCode(),
          title,
          description: description || null,
          stayId: stayId || null,
          roomId: roomId || null,
          responsible: responsible || null,
          status: "pendente",
          type: type || "preventiva",
          isRecurring: true,
          recurrence,
          timezone,
        },
      });

      // 2️⃣ gera as próximas datas (12 meses)
      const horizon = new Date();
      horizon.setMonth(horizon.getMonth() + 12);
      const dates = generateOccurrences(recurrence, horizon, timezone);

      // 3️⃣ cria as instâncias
      const childrenData = [];
      for (const date of dates) {
        childrenData.push({
          code: await generateMaintenanceCode(),
          title,
          description: description || null,
          stayId: stayId || null,
          roomId: roomId || null,
          responsible: responsible || null,
          status: "pendente",
          type: type || "preventiva",
          dueDate: date,
          parentId: parent.id,
          timezone,
        });
      }

      await prisma.$transaction(
        childrenData.map((c) => prisma.maintenanceTask.create({ data: c }))
      );

      return res.status(201).json({ parent, generated: childrenData.length });
    }

    // 🧩 CASO 2: tarefa normal
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
        isRecurring: false,
        timezone,
      },
      include: { stay: true, room: true },
    });

    res.status(201).json(task);
  } catch (err) {
    console.error("Erro ao criar tarefa de manutenção:", err);
    res.status(500).json({ error: "Erro ao criar tarefa de manutenção." });
  }
});

/* ============================================================
   PUT - atualizar tarefa
============================================================ */
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

/* ============================================================
   DELETE - remover tarefa (mantido)
============================================================ */
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

/* ============================================================
   POST /maintenance/:id/generate
   - Regerar próximas ocorrências de um modelo
============================================================ */
router.post("/:id/generate", async (req, res) => {
  try {
    const { id } = req.params;
    const months = parseInt(req.query.months || "12");

    const parent = await prisma.maintenanceTask.findUnique({ where: { id } });
    if (!parent || !parent.isRecurring) {
      return res.status(404).json({ error: "Modelo recorrente não encontrado." });
    }

    const timezone = parent.timezone || "America/Sao_Paulo";
    const horizon = new Date();
    horizon.setMonth(horizon.getMonth() + months);
    const dates = generateOccurrences(parent.recurrence, horizon, timezone);

    let created = 0;
    for (const date of dates) {
      try {
        await prisma.maintenanceTask.create({
          data: {
            code: await generateMaintenanceCode(),
            title: parent.title,
            description: parent.description,
            stayId: parent.stayId,
            roomId: parent.roomId,
            responsible: parent.responsible,
            status: "pendente",
            type: parent.type,
            dueDate: date,
            parentId: parent.id,
            timezone,
          },
        });
        created++;
      } catch (err) {
        if (err.code === "P2002") continue; // duplicado (já existe)
      }
    }

    res.json({ message: `Geradas ${created} novas ocorrências` });
  } catch (err) {
    console.error("Erro ao gerar recorrências:", err);
    res.status(500).json({ error: "Erro ao gerar recorrências." });
  }
});

module.exports = router;
