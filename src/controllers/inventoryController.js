// src/controllers/inventoryController.js

const dayjs = require("dayjs");
const { prisma } = require("../prisma.js");
const { toBaseUnit } = require("../utils/units.js");
const { applyCheckoutConsumption } = require("../services/consumption.js");

async function getInventory(req, res) {
  const { stayId } = req.query;
  const where = stayId ? { stayId: String(stayId) } : {};
  const items = await prisma.inventory.findMany({
    where,
    include: { product: true, stay: true }
  });

  const payload = items.map((i) => {
    const availability = i.capacity > 0 ? (i.quantity / i.capacity) * 100 : 0;
    return {
      inventoryId: i.id,
      stayId: i.stayId,
      productId: i.productId,
      productName: i.product.name,
      quantity: i.quantity,
      capacity: i.capacity,
      availability: Number(availability.toFixed(2)),
      critical: availability < 20
    };
  });

  res.json(payload);
}

async function createOrUpdateInventory(req, res) {
  const { stayId, productId, quantity, capacity } = req.body;
  if (!stayId || !productId)
    return res.status(400).json({ error: "stayId and productId required" });

  const inv = await prisma.inventory.upsert({
    where: { stayId_productId: { stayId, productId } },
    update: { quantity, capacity },
    create: { stayId, productId, quantity: quantity ?? 0, capacity: capacity ?? 0 }
  });

  res.status(201).json(inv);
}

async function patchInventory(req, res) {
  const { id } = req.params;
  const { quantity, capacity, reason = "manual_adjustment" } = req.body;

  const before = await prisma.inventory.findUnique({ where: { id } });
  if (!before) return res.status(404).json({ error: "Inventory not found" });

  const updated = await prisma.$transaction(async (tx) => {
    const inv = await tx.inventory.update({ where: { id }, data: { quantity, capacity } });

    const diff = (quantity ?? inv.quantity) - before.quantity;
    if (diff !== 0) {
      await tx.consumptionEvent.create({
        data: {
          stayId: inv.stayId,
          productId: inv.productId,
          quantity: Math.abs(diff),
          reason,
          occurredAt: new Date()
        }
      });
    }
    return inv;
  });

  res.json(updated);
}

async function createPurchase(req, res) {
  console.log("🧾 Novo POST /purchases:", req.body);

  try {
    const { stayId, productId, quantityValue, quantityUnit, unitPrice, purchaseDate, notes } = req.body;

    if (!stayId) {
      return res.status(400).json({ error: "Campo stayId é obrigatório." });
    }

    // =========================
    // 🔍 VERIFICA PRODUTO
    // =========================
    let product = null;

    if (productId) {
      product = await prisma.product.findUnique({ where: { id: productId } });
    }

    // caso produto não exista, cria um genérico (para compras ocasionais)
    if (!product) {
      console.warn("⚠️ Produto não encontrado, criando genérico...");
      const nomeProduto = notes?.trim() || "Produto Avulso";

      product = await prisma.product.create({
        data: {
          name: nomeProduto,
          category: "Avulso",
          unitBase: quantityUnit?.toUpperCase() || "UN",
          packageSizeValue: Number(quantityValue) || 1,
          packageSizeUnit: quantityUnit || "un",
          defaultPrice: Number(unitPrice) || 0,
          active: false,
        },
      });
    }

    // =========================
    // 📏 CONVERSÃO DE UNIDADES
    // =========================
    let { unitBase, baseValue } = toBaseUnit(Number(quantityValue), quantityUnit);

    if (unitBase !== product.unitBase) {
      console.warn(
        `⚠️ Unidade divergente: produto usa ${product.unitBase}, recebido ${unitBase}. Tentando conversão...`
      );

      // conversões simples
      if (unitBase === "L" && product.unitBase === "ML") baseValue *= 1000;
      else if (unitBase === "ML" && product.unitBase === "L") baseValue /= 1000;
      else if (unitBase === "KG" && product.unitBase === "G") baseValue *= 1000;
      else if (unitBase === "G" && product.unitBase === "KG") baseValue /= 1000;
      else if (unitBase !== product.unitBase) {
        // se não tiver conversão direta
        console.warn("⚠️ Conversão desconhecida. Mantendo valor original.");
      }
    }

    const date = purchaseDate ? dayjs(purchaseDate).toDate() : new Date();

    // =========================
    // 💾 TRANSAÇÃO PRINCIPAL
    // =========================
    const out = await prisma.$transaction(async (tx) => {
      const p = await tx.purchase.create({
        data: {
          stayId,
          productId: product.id,
          quantity: baseValue,
          unitPrice: Number(unitPrice) || 0,
          purchaseDate: date,
          notes,
        },
      });

      await tx.inventory.upsert({
        where: { stayId_productId: { stayId, productId: product.id } },
        update: { quantity: { increment: baseValue } },
        create: {
          stayId,
          productId: product.id,
          quantity: baseValue,
          capacity: baseValue,
        },
      });

      return p;
    });

    res.status(201).json(out);
  } catch (error) {
    console.error("❌ Erro ao criar purchase:", error);
    res.status(400).json({
      error: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack,
    });
  }
}

async function deletePurchase(req, res) {
  const { id } = req.params;
  try {
    const existing = await prisma.purchase.findUnique({ where: { id } });
    if (!existing)
      return res.status(404).json({ error: "Compra não encontrada" });

    await prisma.purchase.delete({ where: { id } });
    res.json({ message: "Compra deletada com sucesso" });
  } catch (error) {
    console.error("❌ Erro ao deletar compra:", error);
    res.status(500).json({ error: "Erro ao deletar compra" });
  }
}


async function listPurchases(req, res) {
  try {
    const { stayId, productId, from, to } = req.query;
    const where = {};

    if (stayId) where.stayId = stayId;
    if (productId) where.productId = productId;
    if (from || to) {
      where.purchaseDate = {};
      if (from) where.purchaseDate.gte = new Date(from);
      if (to) where.purchaseDate.lte = new Date(to);
    }

    const purchases = await prisma.purchase.findMany({
      where,
      include: {
        product: true,
        stay: true,
      },
      orderBy: { purchaseDate: "desc" },
    });

    res.json(purchases);
  } catch (error) {
    console.error("❌ Erro ao listar compras:", error);
    res.status(500).json({ error: "Erro ao listar compras" });
  }
}

async function applyCheckout(req, res) {
  const { reservationId, stayId, roomId, checkoutDate } = req.body;
  if (!stayId || !checkoutDate)
    return res.status(400).json({ error: "stayId and checkoutDate required" });

  try {
    const result = await applyCheckoutConsumption({ reservationId, stayId, roomId, checkoutDate });
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to apply checkout consumption" });
  }
}

module.exports = {
  getInventory,
  createOrUpdateInventory,
  patchInventory,
  createPurchase,
  applyCheckout,
  listPurchases,
  deletePurchase,
};
