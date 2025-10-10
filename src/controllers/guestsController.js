const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/** Helpers */
const toNullIfEmpty = (v) => {
  if (v === undefined) return undefined; // não toca no campo
  if (v === null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t === "" ? null : t;
  }
  return v;
};

const normalizeEmail = (v) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const trimmed = String(v).trim();
  return trimmed === "" ? null : trimmed.toLowerCase();
};

const normalizePhone = (v) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const onlyDigits = String(v).replace(/\D+/g, "");
  return onlyDigits.length ? onlyDigits : null;
};

// CREATE - POST /guests
exports.createGuest = async (req, res) => {
  try {
    let { name, email, phone } = req.body;

    // name obrigatório
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "O nome é obrigatório." });
    }

    // normaliza opcionais
    email = normalizeEmail(email);
    phone = normalizePhone(phone);

    const data = {
      name: String(name).trim(),
    };
    if (email !== undefined) data.email = toNullIfEmpty(email);
    if (phone !== undefined) data.phone = toNullIfEmpty(phone);

    const guest = await prisma.guest.create({ data });
    return res.status(201).json(guest);
  } catch (err) {
    if (err.code === "P2002" && err.meta?.target?.includes("email")) {
      return res.status(409).json({ error: "Já existe um hóspede com esse email." });
    }
    console.error("Erro ao criar hóspede:", err);
    return res.status(500).json({ error: "Erro interno ao criar hóspede." });
  }
};

// READ ALL - GET /guests
exports.getAllGuests = async (req, res) => {
  try {
    const guests = await prisma.guest.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(guests);
  } catch (err) {
    console.error("Erro ao listar hóspedes:", err);
    res.status(500).json({ error: "Erro interno ao listar hóspedes." });
  }
};

// READ ONE - GET /guests/:id
exports.getGuestById = async (req, res) => {
  const { id } = req.params;
  try {
    const guest = await prisma.guest.findUnique({
      where: { id: String(id) },
    });
    if (!guest) {
      return res.status(404).json({ error: "Hóspede não encontrado." });
    }
    res.json(guest);
  } catch (err) {
    console.error("Erro ao buscar hóspede:", err);
    res.status(500).json({ error: "Erro interno ao buscar hóspede." });
  }
};

// UPDATE - PUT /guests/:id
exports.updateGuest = async (req, res) => {
  try {
    const { id } = req.params;
    let { name, email, phone } = req.body;

    const data = {};
    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ error: "Nome não pode ser vazio." });
      }
      data.name = String(name).trim();
    }
    if (email !== undefined) data.email = toNullIfEmpty(normalizeEmail(email));
    if (phone !== undefined) data.phone = toNullIfEmpty(normalizePhone(phone));

    const updatedGuest = await prisma.guest.update({
      where: { id: String(id) },
      data,
    });

    return res.json(updatedGuest);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Hóspede não encontrado." });
    }
    if (err.code === "P2002" && err.meta?.target?.includes("email")) {
      return res.status(409).json({ error: "Já existe um hóspede com esse email." });
    }
    console.error("Erro ao atualizar hóspede:", err);
    return res.status(500).json({ error: "Erro interno ao atualizar hóspede." });
  }
};

// DELETE - DELETE /guests/:id
exports.deleteGuest = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.guest.delete({ where: { id: String(id) } });
    return res.status(204).send();
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Hóspede não encontrado." });
    }
    console.error("Erro ao deletar hóspede:", err);
    return res.status(500).json({ error: "Erro interno ao deletar hóspede." });
  }
};
