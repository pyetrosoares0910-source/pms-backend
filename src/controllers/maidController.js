const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// GET /maids
exports.getAll = async (req, res) => {
  try {
    const maids = await prisma.maid.findMany();
    res.json(maids);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /maids/:id
exports.getById = async (req, res) => {
  const { id } = req.params;
  try {
    const maid = await prisma.maid.findUnique({
      where: { id: parseInt(id, 10) },
    });
    if (!maid) {
      return res.status(404).json({ error: "Diarista não encontrada" });
    }
    res.json(maid);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /maids
exports.create = async (req, res) => {
  const { name, bank, pixKey, available = [] } = req.body;

  if (!name || !bank || !pixKey) {
    return res.status(400).json({ error: "Nome, Banco e Pix são obrigatórios" });
  }

  try {
    const maid = await prisma.maid.create({
      data: { name, bank, pixKey, available },
    });
    res.json(maid);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /maids/:id
exports.update = async (req, res) => {
  const { id } = req.params;
  const { name, bank, pixKey, available = [] } = req.body;

  try {
    const maid = await prisma.maid.update({
      where: { id: parseInt(id, 10) },
      data: { name, bank, pixKey, available },
    });
    res.json(maid);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Diarista não encontrada" });
    }
    res.status(500).json({ error: error.message });
  }
};

// DELETE /maids/:id
exports.remove = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.maid.delete({
      where: { id: parseInt(id, 10) },
    });
    res.json({ message: "Diarista removida com sucesso" });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Diarista não encontrada" });
    }
    res.status(500).json({ error: error.message });
  }
};
