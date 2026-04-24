const { prisma } = require("../prisma");
const { calculateNextExecutionDate, toUtcDay } = require("../services/periodicTaskSchedule");

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

function normalizeTaskInput(body, currentTask = {}) {
  const isCreate = !currentTask.id;
  const scheduleChanged =
    body.frequency !== undefined ||
    body.customIntervalDays !== undefined ||
    body.lastExecutionDate !== undefined;
  const frequency = body.frequency || currentTask.frequency;
  const customIntervalDays =
    body.customIntervalDays !== undefined
      ? Number(body.customIntervalDays)
      : currentTask.customIntervalDays;
  const lastExecutionDate =
    body.lastExecutionDate !== undefined
      ? parseOptionalDate(body.lastExecutionDate)
      : currentTask.lastExecutionDate || null;

  let nextExecutionDate = currentTask.nextExecutionDate;
  if (body.nextExecutionDate !== undefined) {
    nextExecutionDate = parseOptionalDate(body.nextExecutionDate);
  } else if (isCreate || scheduleChanged) {
    nextExecutionDate = calculateNextExecutionDate({
      frequency,
      customIntervalDays,
      fromDate: lastExecutionDate || new Date(),
    });
  }

  return {
    name: body.name ?? currentTask.name,
    description: body.description === undefined ? currentTask.description ?? null : body.description || null,
    frequency,
    customIntervalDays: frequency === "CUSTOM_DAYS" ? customIntervalDays : null,
    lastExecutionDate,
    nextExecutionDate,
    active: body.active === undefined ? currentTask.active ?? true : Boolean(body.active),
    roomId: body.roomId ?? currentTask.roomId,
  };
}

exports.list = async (req, res) => {
  try {
    const { active, roomId, stayId } = req.query;
    const where = {};

    if (active !== undefined) where.active = active === "true";
    if (roomId) where.roomId = roomId;
    if (stayId) where.room = { stayId };

    const tasks = await prisma.periodicTask.findMany({
      where,
      include: { room: { include: { stay: true } } },
      orderBy: [{ active: "desc" }, { nextExecutionDate: "asc" }, { name: "asc" }],
    });

    res.json(tasks);
  } catch (err) {
    console.error("Erro ao listar tarefas periodicas:", err);
    res.status(500).json({ error: "Erro ao listar tarefas periodicas." });
  }
};

exports.create = async (req, res) => {
  try {
    if (!req.body.name || !req.body.frequency || !req.body.roomId) {
      return res.status(400).json({ error: "name, frequency e roomId sao obrigatorios." });
    }

    const data = normalizeTaskInput(req.body);
    const task = await prisma.periodicTask.create({
      data,
      include: { room: { include: { stay: true } } },
    });

    res.status(201).json(task);
  } catch (err) {
    console.error("Erro ao criar tarefa periodica:", err);
    res.status(err.status || 500).json({ error: err.message || "Erro ao criar tarefa periodica." });
  }
};

exports.update = async (req, res) => {
  try {
    const currentTask = await prisma.periodicTask.findUnique({ where: { id: req.params.id } });
    if (!currentTask) return res.status(404).json({ error: "Tarefa periodica nao encontrada." });

    const normalized = normalizeTaskInput(req.body, currentTask);
    const data = Object.fromEntries(
      Object.entries(normalized).filter(([, value]) => value !== undefined)
    );

    const updated = await prisma.periodicTask.update({
      where: { id: req.params.id },
      data,
      include: { room: { include: { stay: true } } },
    });

    res.json(updated);
  } catch (err) {
    console.error("Erro ao atualizar tarefa periodica:", err);
    res.status(err.status || 500).json({ error: err.message || "Erro ao atualizar tarefa periodica." });
  }
};

exports.remove = async (req, res) => {
  try {
    await prisma.periodicTask.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Tarefa periodica nao encontrada." });
    }
    console.error("Erro ao remover tarefa periodica:", err);
    res.status(500).json({ error: "Erro ao remover tarefa periodica." });
  }
};

exports.createExecution = async (req, res) => {
  try {
    const task = await prisma.periodicTask.findUnique({ where: { id: req.params.id } });
    if (!task) return res.status(404).json({ error: "Tarefa periodica nao encontrada." });

    const executionDate = parseOptionalDate(req.body.executionDate || new Date());
    const status = req.body.status || "COMPLETED";

    const execution = await prisma.periodicTaskExecution.upsert({
      where: {
        taskId_roomId_executionDate: {
          taskId: task.id,
          roomId: req.body.roomId || task.roomId,
          executionDate,
        },
      },
      create: {
        taskId: task.id,
        roomId: req.body.roomId || task.roomId,
        assignedToId: req.body.assignedToId ? Number(req.body.assignedToId) : null,
        executionDate,
        status,
        notes: req.body.notes || null,
      },
      update: {
        assignedToId: req.body.assignedToId ? Number(req.body.assignedToId) : null,
        status,
        notes: req.body.notes || null,
      },
      include: { assignedTo: true, room: true, task: true },
    });

    if (status === "COMPLETED") {
      await prisma.periodicTask.update({
        where: { id: task.id },
        data: {
          lastExecutionDate: executionDate,
          nextExecutionDate: calculateNextExecutionDate({
            frequency: task.frequency,
            customIntervalDays: task.customIntervalDays,
            fromDate: executionDate,
          }),
        },
      });
    }

    res.status(201).json(execution);
  } catch (err) {
    console.error("Erro ao registrar execucao periodica:", err);
    res.status(err.status || 500).json({ error: err.message || "Erro ao registrar execucao periodica." });
  }
};

exports.listExecutions = async (req, res) => {
  try {
    const where = {};
    if (req.query.taskId) where.taskId = req.query.taskId;
    if (req.query.assignedToId) where.assignedToId = Number(req.query.assignedToId);

    const executions = await prisma.periodicTaskExecution.findMany({
      where,
      include: {
        task: true,
        room: { include: { stay: true } },
        assignedTo: true,
      },
      orderBy: { executionDate: "desc" },
    });

    res.json(executions);
  } catch (err) {
    console.error("Erro ao listar execucoes periodicas:", err);
    res.status(500).json({ error: "Erro ao listar execucoes periodicas." });
  }
};
