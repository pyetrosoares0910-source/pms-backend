const path = require("path");
const { PrismaClient } = require("@prisma/client");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

const prisma = new PrismaClient();

function normalizeRoomPayload(payload = {}) {
  const normalized = { ...payload };

  ["category", "description", "stayId"].forEach((field) => {
    if (typeof normalized[field] === "string") {
      normalized[field] = normalized[field].trim();
      if (!normalized[field]) normalized[field] = null;
    }
  });

  if (typeof normalized.title === "string") {
    normalized.title = normalized.title.trim();
  }

  if (
    normalized.position === "" ||
    normalized.position === null ||
    typeof normalized.position === "undefined"
  ) {
    normalized.position = null;
  } else {
    const parsedPosition = Number.parseInt(normalized.position, 10);
    normalized.position = Number.isNaN(parsedPosition)
      ? normalized.position
      : parsedPosition;
  }

  return normalized;
}

function handlePrismaRoomError(err, res, fallbackMessage) {
  if (err?.code === "P2002") {
    return res.status(409).json({
      error: "Ja existe um quarto com esse titulo neste empreendimento.",
      details: err.message,
    });
  }

  if (err?.name === "PrismaClientValidationError") {
    return res.status(400).json({
      error: fallbackMessage,
      details: err.message,
    });
  }

  return res.status(500).json({ error: fallbackMessage, details: err.message });
}

// Configuracao Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Multer (em memoria)
const storage = multer.memoryStorage();
const upload = multer({ storage });
exports.uploadMiddleware = upload.single("image");

// GET /rooms
// GET /rooms?includeInactive=true
exports.getAllRooms = async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive) === "true";

    const rooms = await prisma.room.findMany({
      where: includeInactive ? {} : { active: true },
      include: { stay: true },
      orderBy: { position: "asc" },
    });

    const cleanRooms = rooms.map((room) => ({
      ...room,
      imageUrl:
        room.imageUrl && room.imageUrl.startsWith("http") ? room.imageUrl : null,
    }));

    res.json(cleanRooms);
  } catch (err) {
    console.error("Erro ao listar quartos:", err);
    res.status(500).json({ error: "Erro interno ao listar quartos." });
  }
};

// GET /rooms/:id
// GET /rooms/:id?includeInactive=true
exports.getRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const includeInactive = String(req.query.includeInactive) === "true";

    const room = await prisma.room.findUnique({
      where: { id },
      include: { stay: true },
    });

    if (!room || (!includeInactive && room.active === false)) {
      return res.status(404).json({ error: "Room nao encontrado" });
    }

    res.json({
      ...room,
      imageUrl: room.imageUrl && room.imageUrl.startsWith("http") ? room.imageUrl : null,
    });
  } catch (err) {
    console.error("Erro ao buscar quarto:", err);
    res.status(500).json({ error: "Erro ao buscar quarto.", details: err.message });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const data = normalizeRoomPayload(req.body);
    const newRoom = await prisma.room.create({ data });
    res.status(201).json(newRoom);
  } catch (err) {
    console.error("Erro ao criar quarto:", err);
    return handlePrismaRoomError(err, res, "Erro ao criar quarto.");
  }
};

exports.updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const data = normalizeRoomPayload(req.body);
    const updated = await prisma.room.update({
      where: { id },
      data,
    });
    res.json(updated);
  } catch (err) {
    console.error("Erro ao atualizar quarto:", err);
    return handlePrismaRoomError(err, res, "Erro ao atualizar quarto.");
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.room.delete({ where: { id } });
    res.json({ message: "Room deletado com sucesso." });
  } catch (err) {
    console.error("Erro ao deletar quarto:", err);
    res.status(500).json({ error: "Erro ao deletar quarto.", details: err.message });
  }
};

exports.uploadRoomImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado" });
    }

    const fileBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(fileBase64, {
      folder: "rooms",
      resource_type: "image",
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    });

    const room = await prisma.room.update({
      where: { id: req.params.id },
      data: { imageUrl: result.secure_url },
    });

    res.json({
      message: "Upload concluido com sucesso!",
      imageUrl: result.secure_url,
      room,
    });
  } catch (error) {
    console.error("Erro ao enviar imagem:", error);
    res.status(500).json({ error: "Falha no upload", details: error.message });
  }
};
