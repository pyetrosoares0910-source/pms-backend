const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// GET - listar empreendimentos com rooms + reservas + guest
router.get("/", async (req, res) => {
  try {
    const stays = await prisma.stay.findMany({
      include: {
        rooms: {
          include: {
            reservations: {
              include: { guest: true }, // 🔹 puxa nome do hóspede
            },
          },
        },
      },
      orderBy: { position: "asc" }, // 🔹 ordena pela posição configurada
    });
    res.json(stays);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - criar novo empreendimento
router.post("/", async (req, res) => {
  try {
    const { name, position } = req.body;
    const stay = await prisma.stay.create({
      data: {
        name,
        position: position ? parseInt(position, 10) : null, // 🔹 salva posição numérica
      },
    });
    res.json(stay);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT - atualizar empreendimento
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, position } = req.body;

    const stay = await prisma.stay.update({
      where: { id },
      data: {
        name,
        position:
          position !== undefined
            ? parseInt(position, 10)
            : undefined, // 🔹 converte caso venha string
      },
    });

    res.json(stay);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - remover empreendimento
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.stay.delete({ where: { id } });
    res.json({ message: "Empreendimento removido" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
