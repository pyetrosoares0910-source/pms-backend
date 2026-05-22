const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("../utils/auth");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const storage = multer.memoryStorage();
const upload = multer({ storage });
const uploadMiddleware = upload.single("image");

/**
 * Criar funcionário (com senha)
 */
async function createStaff(req, res) {
  try {
    const { name, email, password, role = "STAFF", phone, active = true } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Campos obrigatórios: name, email, password." });
    }

    const passwordHash = await hashPassword(password);

    const created = await prisma.staff.create({
      data: { name, email, passwordHash, role, phone, active },
    });

    const { passwordHash: _, ...safe } = created;
    return res.status(201).json(safe);
  } catch (err) {
    if (err.code === "P2002" && err.meta?.target?.includes("email")) {
      return res.status(409).json({ error: "Email já cadastrado." });
    }
    console.error(err);
    return res.status(500).json({ error: "Erro ao criar funcionário." });
  }
}

/**
 * Listar todos os funcionários
 */
async function getAllStaff(req, res) {
  try {
    const staff = await prisma.staff.findMany();
    const safe = staff.map(({ passwordHash, ...s }) => s);
    return res.json(safe);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao listar funcionários." });
  }
}

/**
 * Buscar funcionário por ID
 */
async function getStaffById(req, res) {
  try {
    const { id } = req.params;
    const staff = await prisma.staff.findUnique({
      where: { id: String(id) }, // 🔑 antes era Number(id)
    });

    if (!staff) {
      return res.status(404).json({ error: "Funcionário não encontrado." });
    }

    const { passwordHash, ...safe } = staff;
    return res.json(safe);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erro ao buscar funcionário." });
  }
}

/**
 * Atualizar funcionário
 */
async function updateStaff(req, res) {
  try {
    const { id } = req.params;
    const { name, email, password, role, phone, active } = req.body || {};

    const data = { name, email, role, phone, active };

    if (password) {
      data.passwordHash = await hashPassword(password);
    }

    const updated = await prisma.staff.update({
      where: { id: String(id) }, // 🔑 antes era Number(id)
      data,
    });

    const { passwordHash: _, ...safe } = updated;
    return res.json(safe);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Funcionário não encontrado." });
    }
    console.error(err);
    return res.status(500).json({ error: "Erro ao atualizar funcionário." });
  }
}

async function uploadStaffImage(req, res) {
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

    const updated = await prisma.staff.update({
      where: { id: String(req.params.id) },
      data: { imageUrl: result.secure_url },
    });

    const { passwordHash: _, ...safe } = updated;
    return res.json({
      message: "Upload concluido com sucesso!",
      imageUrl: result.secure_url,
      staff: safe,
    });
  } catch (error) {
    console.error("Erro ao enviar imagem do funcionario:", error);
    return res.status(500).json({ error: "Falha no upload", details: error.message });
  }
}

/**
 * Deletar funcionário
 */
async function deleteStaff(req, res) {
  try {
    const { id } = req.params;
    await prisma.staff.delete({ where: { id: String(id) } }); // 🔑 antes era Number(id)
    return res.status(204).send();
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Funcionário não encontrado." });
    }
    console.error(err);
    return res.status(500).json({ error: "Erro ao deletar funcionário." });
  }
}

module.exports = {
  createStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  uploadMiddleware,
  uploadStaffImage,
  deleteStaff,
};
