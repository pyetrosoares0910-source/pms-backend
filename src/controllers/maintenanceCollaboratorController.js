const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function parseOptionalDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function collaboratorPayload(body) {
  return {
    name: String(body.name || "").trim(),
    birthDate: parseOptionalDate(body.birthDate),
    cpf: body.cpf ? String(body.cpf).trim() : null,
    pixKey: body.pixKey ? String(body.pixKey).trim() : null,
    bankName: body.bankName ? String(body.bankName).trim() : null,
    active: body.active === undefined ? true : Boolean(body.active),
    notes: body.notes ? String(body.notes).trim() : null,
  };
}

exports.getAll = async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const collaborators = await prisma.maintenanceCollaborator.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
    res.json(collaborators);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const collaborator = await prisma.maintenanceCollaborator.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!collaborator) {
      return res.status(404).json({ error: "Colaborador nao encontrado." });
    }
    res.json(collaborator);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.create = async (req, res) => {
  const data = collaboratorPayload(req.body);
  if (!data.name) {
    return res.status(400).json({ error: "Nome e obrigatorio." });
  }

  try {
    const collaborator = await prisma.maintenanceCollaborator.create({ data });
    res.status(201).json(collaborator);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.update = async (req, res) => {
  const data = collaboratorPayload(req.body);
  if (!data.name) {
    return res.status(400).json({ error: "Nome e obrigatorio." });
  }

  try {
    const collaborator = await prisma.maintenanceCollaborator.update({
      where: { id: String(req.params.id) },
      data,
    });
    res.json(collaborator);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Colaborador nao encontrado." });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    await prisma.maintenanceCollaborator.delete({
      where: { id: String(req.params.id) },
    });
    res.json({ message: "Colaborador removido com sucesso." });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Colaborador nao encontrado." });
    }
    res.status(500).json({ error: error.message });
  }
};
