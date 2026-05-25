// src/controllers/productController.js

const { prisma } = require("../prisma.js");
const { toBaseUnit } = require("../utils/units.js");

function parseNullableFloat(value) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeProductPayload(data = {}) {
  const parsed = {
    name: data.name,
    category: data.category,
    unitBase: data.unitBase,
    packageSizeUnit: data.packageSizeUnit,
    active: data.active,
    sku: data.sku,
    supplier: data.supplier,
    usageUnit: data.usageUnit,
    shelfLifeDays: data.shelfLifeDays ? parseInt(data.shelfLifeDays, 10) : null,
    notes: data.notes,
    packageSizeValue: data.packageSizeValue
      ? parseInt(data.packageSizeValue, 10)
      : null,
    defaultPrice: parseNullableFloat(data.defaultPrice),
    minimumStock: parseNullableFloat(data.minimumStock),
    targetStock: parseNullableFloat(data.targetStock),
    reorderPoint: parseNullableFloat(data.reorderPoint),
    packageBaseQuantity: parseNullableFloat(data.packageBaseQuantity),
    unitsPerPackage: parseNullableFloat(data.unitsPerPackage),
    corridorWeight: data.corridorWeight === "" || data.corridorWeight === undefined
      ? 1
      : parseNullableFloat(data.corridorWeight),
  };

  if (!parsed.packageBaseQuantity && data.packageSizeValue && data.packageSizeUnit) {
    try {
      const normalized = toBaseUnit(Number(data.packageSizeValue), data.packageSizeUnit);
      parsed.packageBaseQuantity = normalized.baseValue;
      if (!parsed.unitBase) parsed.unitBase = normalized.unitBase;
    } catch {
      parsed.packageBaseQuantity = null;
    }
  }

  if (parsed.unitBase === "UNIT" && !parsed.unitsPerPackage && data.packageSizeValue) {
    parsed.unitsPerPackage = Number(data.packageSizeValue);
    parsed.packageBaseQuantity = Number(data.packageSizeValue);
  }

  parsed.usageUnit = parsed.usageUnit || (parsed.unitBase === "ML" ? "ml" : parsed.unitBase === "G" ? "g" : "un");
  Object.keys(parsed).forEach((key) => {
    if (parsed[key] === undefined) delete parsed[key];
  });
  return parsed;
}

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
  const parsedData = normalizeProductPayload(req.body);

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
    data: normalizeProductPayload(req.body)
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

async function deleteProduct(req, res) {
  try {
    await prisma.product.delete({ where: { id: String(req.params.id) } });
    res.json({ deleted: true, id: String(req.params.id) });
  } catch (error) {
    if (error?.code === "P2003") {
      return res.status(409).json({
        error: "Produto possui registros vinculados. Exclua entradas/saldos/consumos antes ou desative o produto.",
      });
    }
    console.error("Erro ao excluir produto:", error);
    res.status(500).json({ error: "Erro ao excluir produto" });
  }
}

module.exports = {
  listProducts,
  createProduct,
  getProduct,
  updateProduct,
  toggleProduct,
  deleteProduct
};
