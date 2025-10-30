const path = require("path");
const { PrismaClient } = require("@prisma/client");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

const prisma = new PrismaClient();

// ☁️ Configuração Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
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

    // Remove fallback local — só mantém URLs Cloudinary válidas
    const cleanRooms = rooms.map((r) => ({
      ...r,
      imageUrl: r.imageUrl && r.imageUrl.startsWith("http")
        ? r.imageUrl
        : null,
    }));

    res.json(cleanRooms);
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

    if (!room) {
      return res.status(404).json({ error: "Room não encontrado" });
    }

    res.json({
      ...room,
      imageUrl: room.imageUrl && room.imageUrl.startsWith("http")
        ? room.imageUrl
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

// 📤 Upload Room Image (Cloudinary)
exports.uploadRoomImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    // Converte buffer para Base64
    const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    // Faz upload otimizado pro Cloudinary
    const result = await cloudinary.uploader.upload(fileBase64, {
      folder: "rooms",
      resource_type: "image",
      transformation: [
        { quality: "auto", fetch_format: "auto" }, // compressão e conversão automáticas
      ],
    });

    // Atualiza no banco
    const room = await prisma.room.update({
      where: { id: req.params.id },
      data: { imageUrl: result.secure_url },
    });

    res.json({
      message: "Upload concluído com sucesso!",
      imageUrl: result.secure_url,
      room,
    });
  } catch (error) {
    console.error("❌ Erro ao enviar imagem:", error);
    res.status(500).json({ error: "Falha no upload", details: error.message });
  }
};
