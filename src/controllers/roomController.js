const path = require("path");
const { PrismaClient } = require("@prisma/client");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

const prisma = new PrismaClient();
const BASE_URL = process.env.BASE_URL || "https://pms-backend-d3e1.onrender.com";

/* ============================
   ☁️ Configuração do Cloudinary
============================ */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ============================
   📦 Configuração do Multer (Buffer)
============================ */
const storage = multer.memoryStorage(); // usa memória temporária (sem salvar em disco)
const upload = multer({ storage });
exports.uploadMiddleware = upload.single("image");

/* ============================
   🧠 CRUD DE ROOMS
============================ */

// 🟢 Listar todos
exports.getAllRooms = async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({ include: { stay: true } });

    const roomsWithFullImage = rooms.map((r) => ({
      ...r,
      imageUrl: r.imageUrl
        ? r.imageUrl.startsWith("http")
          ? r.imageUrl
          : `${BASE_URL}${r.imageUrl}`
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
        ? room.imageUrl.startsWith("http")
          ? room.imageUrl
          : `${BASE_URL}${room.imageUrl}`
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
   📸 Upload de Imagem (Cloudinary)
============================ */
exports.uploadRoomImage = [
  upload.single("image"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
      }

      // 🚀 Envia o buffer direto para o Cloudinary
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "staycore/rooms", resource_type: "image" },
          (error, result) => (error ? reject(error) : resolve(result))
        );
        stream.end(req.file.buffer);
      });

      // 💾 Atualiza no banco com URL pública
      const updatedRoom = await prisma.room.update({
        where: { id },
        data: { imageUrl: result.secure_url },
      });

      console.log("✅ Imagem enviada ao Cloudinary:", result.secure_url);

      res.json({
        message: "Imagem enviada com sucesso!",
        room: {
          ...updatedRoom,
          imageUrl: result.secure_url,
        },
      });
    } catch (err) {
      console.error("❌ Erro no upload da imagem (Cloudinary):", err);
      res.status(500).json({
        error: "Erro interno ao enviar imagem.",
        details: err.message,
      });
    }
  },
];
