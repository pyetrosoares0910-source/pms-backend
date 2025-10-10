const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// GET
router.get("/", async (req, res) => {
  const staff = await prisma.cleaningStaff.findMany();
  res.json(staff);
});

// POST
router.post("/", async (req, res) => {
  const { name, status } = req.body;
  const member = await prisma.cleaningStaff.create({
    data: { name, status },
  });
  res.json(member);
});

// PUT
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, status } = req.body;
  const member = await prisma.cleaningStaff.update({
    where: { id },
    data: { name, status },
  });
  res.json(member);
});

// DELETE
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  await prisma.cleaningStaff.delete({ where: { id } });
  res.json({ message: "Membro removido" });
});

module.exports = router;
