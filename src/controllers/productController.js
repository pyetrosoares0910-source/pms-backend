// src/controllers/productController.js

const { prisma } = require("../prisma.js");

async function listProducts(req, res) {
  const { active, search } = req.query;
  const where = {};
  if (active !== undefined) where.active = active === "true";
  if (search) {
    where.OR = [
      { name: { contains: String(search), mode: "insensitive" } },
      { category: { contains: String(search), mode: "insensitive" } }
    ];
  }

  const items = await prisma.product.findMany({ where, orderBy: { name: "asc" } });
  res.json(items);
}

async function createProduct(req, res) {
  const data = req.body; 

  const parsedData = {
    ...data,
    packageSizeValue: data.packageSizeValue
      ? parseInt(data.packageSizeValue)
      : null,
    defaultPrice: data.defaultPrice
      ? parseFloat(data.defaultPrice)
      : null,
  };

  try {
    const item = await prisma.product.create({ data: parsedData });
    res.status(201).json(item);
  } catch (error) {
    console.error("❌ Erro ao criar produto:", error);
    res.status(500).json({ error: "Erro ao criar produto" });
  }
}


async function getProduct(req, res) {
  const item = await prisma.product.findUnique({ where: { id: String(req.params.id) } });
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
}

async function updateProduct(req, res) {
  const item = await prisma.product.update({
    where: { id: String(req.params.id) },
    data: req.body
  });
  res.json(item);
}

async function toggleProduct(req, res) {
  const current = await prisma.product.findUnique({ where: { id: String(req.params.id) } });
  if (!current) return res.status(404).json({ error: "Not found" });
  const updated = await prisma.product.update({
    where: { id: current.id },
    data: { active: !current.active }
  });
  res.json(updated);
}

module.exports = {
  listProducts,
  createProduct,
  getProduct,
  updateProduct,
  toggleProduct
};
