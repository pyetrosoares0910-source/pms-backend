const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const BASE_URL = process.env.BASE_URL || "https://pms-backend-d3e1.onrender.com";

/* ============================
   📦 Configuração de Upload (Multer)
============================ */

// 🧠 Garante que a pasta existe ANTES de configurar o multer
const UPLOADS_DIR = path.join(__dirname, "../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log("📁 Pasta /uploads criada com sucesso.");
}

// 🧩 Configuração do Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });
exports.uploadMiddleware = upload.single("image");

/* ============================
   🧠 CRUD DE ROOMS
============================ */

// 🟢 Listar todos
exports.getAllRooms = async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      include: { stay: true },
    });

    const roomsWithFullImage = rooms.map((r) => ({
      ...r,
      imageUrl: r.imageUrl
        ? `${BASE_URL}${r.imageUrl.startsWith("/") ? "" : "/"}${r.imageUrl}`
        : null,
    }));

    res.json(roomsWithFullImage);
  } catch (err) {
    console.error("❌ Erro ao listar quartos:", err);
    res.status(500).json({ error: "Erro interno ao listar quartos." });
  }
};

// 🟢 Buscar por ID
exports.getRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await prisma.room.findUnique({
      where: { id },
      include: { stay: true },
    });

    if (!room) return res.status(404).json({ error: "Room não encontrado" });

    res.json({
      ...room,
      imageUrl: room.imageUrl
        ? `${BASE_URL}${room.imageUrl.startsWith("/") ? "" : "/"}${room.imageUrl}`
        : null,
    });
  } catch (err) {
    console.error("❌ Erro ao buscar quarto:", err);
    res.status(500).json({ error: "Erro ao buscar quarto.", details: err.message });
  }
};

// 🟢 Criar
exports.createRoom = async (req, res) => {
  try {
    const data = req.body;
    const newRoom = await prisma.room.create({ data });
    res.status(201).json(newRoom);
  } catch (err) {
    console.error("❌ Erro ao criar quarto:", err);
    res.status(500).json({ error: "Erro ao criar quarto.", details: err.message });
  }
};

// 🟢 Atualizar
exports.updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const updated = await prisma.room.update({
      where: { id },
      data,
    });
    res.json(updated);
  } catch (err) {
    console.error("❌ Erro ao atualizar quarto:", err);
    res.status(500).json({ error: "Erro ao atualizar quarto.", details: err.message });
  }
};

// 🟢 Excluir
exports.deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.room.delete({ where: { id } });
    res.json({ message: "Room deletado com sucesso." });
  } catch (err) {
    console.error("❌ Erro ao deletar quarto:", err);
    res.status(500).json({ error: "Erro ao deletar quarto.", details: err.message });
  }
};

/* ============================
   📸 Upload de Imagem
============================ */
exports.uploadRoomImage = [
  upload.single("image"),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!req.file)
        return res.status(400).json({ error: "Nenhum arquivo enviado." });

      const imagePath = `/uploads/${req.file.filename}`;

      const updatedRoom = await prisma.room.update({
        where: { id },
        data: { imageUrl: imagePath },
      });

      console.log(`✅ Imagem salva: ${imagePath}`);

      res.json({
        message: "Imagem enviada com sucesso!",
        room: {
          ...updatedRoom,
          imageUrl: `${BASE_URL}${imagePath}`,
        },
      });
    } catch (err) {
      console.error("❌ Erro no upload da imagem:", err);
      res.status(500).json({ error: "Erro interno ao enviar imagem.", details: err.message });
    }
  },
];
