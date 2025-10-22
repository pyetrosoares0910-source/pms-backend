const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const path = require("path");
const fs = require("fs");
const multer = require("multer");



// GET /rooms
exports.getAllRooms = async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      include: { stay: true }, // vem empreendimento
       orderBy: [
    { stay: { position: 'asc' } }, // primeiro empreendimento
    { position: 'asc' },           // depois UH
  ],
});
    res.json(rooms);
  } catch (error) {
    console.error("Erro ao listar quartos:", error);
    res.status(500).json({ error: "Erro interno ao listar quartos." });
  }
};

// GET /rooms/:id
exports.getRoomById = async (req, res) => {
  const { id } = req.params;
  try {
    const room = await prisma.room.findUnique({
      where: { id: String(id) },
      include: { stay: true },
    });

    if (!room) {
      return res.status(404).json({ message: "Acomodação não encontrada." });
    }

    res.json(room);
  } catch (error) {
    console.error("Erro ao buscar quarto:", error);
    res.status(500).json({ error: "Erro interno ao buscar quarto." });
  }
};

// POST /rooms
exports.createRoom = async (req, res) => {
  try {
    const { title, category, position, capacity, description, stayId } = req.body;

    const room = await prisma.room.create({
      data: {
        title,
        category: category || null,
        position: position !== undefined && position !== null && position !== ""
  ? parseInt(position, 10)
  : null,

        capacity: capacity ? parseInt(capacity) : null,
        description: description || null,
        stayId: stayId || null, // se não mandar, fica null
      },
      include: { stay: true },
    });

    res.status(201).json(room);
  } catch (error) {
    console.error("Erro ao criar quarto:", error);
    res.status(500).json({ error: "Erro interno ao criar quarto." });
  }
};

// PUT /rooms/:id
exports.updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, position, capacity, description, active, stayId } = req.body;

    const updatedRoom = await prisma.room.update({
      where: { id: String(id) },
      data: {
        title,
        category: category !== undefined ? category : undefined,
        position:
  position !== undefined
    ? parseInt(position, 10)
    : undefined,
        capacity: capacity !== undefined ? parseInt(capacity) : undefined,
        description,
        active,
        stayId: stayId !== undefined ? stayId : undefined,
      },
      include: { stay: true },
    });

    return res.json(updatedRoom);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Quarto não encontrado." });
    }
    console.error("Erro ao atualizar quarto:", err);
    return res.status(500).json({ error: "Erro interno ao atualizar quarto." });
  }
};

// DELETE /rooms/:id
exports.deleteRoom = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.room.delete({ where: { id: String(id) } });
    res.json({ message: "Acomodação removida com sucesso." });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Quarto não encontrado." });
    }
    console.error("Erro ao deletar quarto:", error);
    res.status(500).json({ error: "Erro interno ao deletar quarto." });
  }
};

// save local image

const uploadDir = path.join(__dirname, "../uploads/rooms");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/\s/g, "_")}`),
});

exports.uploadRoomImage = [
  multer({ storage }).single("image"),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

      const imageUrl = `/uploads/rooms/${req.file.filename}`;

      const room = await prisma.room.update({
        where: { id: parseInt(id) },
        data: { imageUrl },
      });

      res.json({ message: "Imagem atualizada com sucesso!", room });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erro ao salvar imagem" });
    }
  },
];