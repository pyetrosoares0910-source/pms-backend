// src/controllers/consumptionProfileController.js

const { prisma } = require("../prisma.js");

async function listProfiles(req, res) {
  const { stayId, roomId } = req.query;
  const where = {};
  if (stayId) where.stayId = String(stayId);
  if (roomId !== undefined) where.roomId = roomId ? String(roomId) : null;

  const items = await prisma.consumptionProfile.findMany({
    where,
    include: { product: true, room: true },
    orderBy: { productId: "asc" }
  });

  res.json(items);
}

async function createProfile(req, res) {
  const data = req.body;
  const item = await prisma.consumptionProfile.create({ data });
  res.status(201).json(item);
}

async function updateProfile(req, res) {
  const item = await prisma.consumptionProfile.update({
    where: { id: String(req.params.id) },
    data: req.body
  });
  res.json(item);
}

async function deleteProfile(req, res) {
  await prisma.consumptionProfile.delete({ where: { id: String(req.params.id) } });
  res.status(204).send();
}

module.exports = {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile
};
