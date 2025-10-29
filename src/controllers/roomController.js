const path = require("path");
const { PrismaClient } = require("@prisma/client");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

const prisma = new PrismaClient();
const BASE_URL = process.env.BASE_URL || "https://pms-backend-d3e1.onrender.com";

// ☁️ Configuração Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 📦 Multer (em memória)
const storage = multer.memoryStorage();
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
      orderBy: { position: "asc" }, 
    });

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

// 📤 Upload Room Image
exports.uploadRoomImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    // Converte o buffer em base64 para enviar ao Cloudinary
    const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(fileBase64, {
      folder: "rooms",
      resource_type: "image",
    });

    // Atualiza no banco
    const room = await prisma.room.update({
      where: { id: req.params.id },
      data: { imageUrl: result.secure_url },
    });

    res.json({ message: "Upload concluído com sucesso!", room });
  } catch (error) {
    console.error("❌ Erro ao enviar imagem:", error);
    res.status(500).json({ error: error.message });
  }
};
