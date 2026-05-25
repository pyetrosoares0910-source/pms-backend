const dayjs = require("dayjs");
const { prisma } = require("../prisma.js");
const { toBaseUnit } = require("../utils/units.js");

const DEFAULT_WINDOW_DAYS = 30;
const HISTORY_DAYS = 180;
const CRITICAL_DAYS = 7;
const WARNING_DAYS = 14;

const laundryPieces = {
  FITTED_SHEET: 1,
  TOP_SHEET: 1,
  PILLOWCASE: 1,
  SHEET_SET: 2,
  PILLOWCASE_SET: 2,
  BLANKET: 1,
  BEDSPREAD: 1,
  FACE_TOWEL: 1,
  BATH_TOWEL: 1,
};

function buildDefaultLaundryItems(room, overrides = []) {
  const preparedBeds = Math.max(0, Number(room?.preparedBeds || 1));
  const template = room?.laundryTemplate && typeof room.laundryTemplate === "object"
    ? room.laundryTemplate
    : {};
  const base = {
    FITTED_SHEET: Number(template.FITTED_SHEET ?? preparedBeds),
    TOP_SHEET: Number(template.TOP_SHEET ?? preparedBeds),
    PILLOWCASE: Number(template.PILLOWCASE ?? preparedBeds * 2),
    BLANKET: Number(template.BLANKET ?? 0),
    BEDSPREAD: Number(template.BEDSPREAD ?? 0),
    FACE_TOWEL: Number(template.FACE_TOWEL ?? preparedBeds),
    BATH_TOWEL: Number(template.BATH_TOWEL ?? preparedBeds),
  };

  overrides.forEach((item) => {
    if (!item?.itemType) return;
    base[item.itemType] = Math.max(0, Math.round(Number(item.quantity || 0)));
  });

  return Object.entries(base).map(([itemType, quantity]) => ({
    itemType,
    quantity,
    unitPieces: Number(laundryPieces[itemType] || 1),
  }));
}

function assertRequired(data, fields) {
  const missing = fields.filter((field) => data[field] === undefined || data[field] === null || data[field] === "");
  if (missing.length) {
    const error = new Error(`Campos obrigatorios: ${missing.join(", ")}`);
    error.status = 400;
    throw error;
  }
}

function parsePositiveNumber(value, field) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    const error = new Error(`${field} deve ser um numero maior que zero.`);
    error.status = 400;
    throw error;
  }
  return parsed;
}

function normalizeQuantity(value, unit) {
  const quantity = parsePositiveNumber(value, "quantity");
  try {
    return toBaseUnit(quantity, String(unit || "").trim());
  } catch {
    const error = new Error("Unidade nao suportada. Use ml, L, g, kg ou un.");
    error.status = 400;
    throw error;
  }
}

function round(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

function sum(items, pick) {
  return items.reduce((total, item) => total + Number(pick(item) || 0), 0);
}

function mean(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return 0;
  return sum(clean, (value) => value) / clean.length;
}

function stddev(values) {
  const avg = mean(values);
  if (!avg || values.length < 2) return 0;
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

function getDateRange(query = {}) {
  const to = query.to ? dayjs(query.to).endOf("day") : dayjs().endOf("day");
  const from = query.from ? dayjs(query.from).startOf("day") : to.subtract(DEFAULT_WINDOW_DAYS - 1, "day").startOf("day");
  return { from: from.toDate(), to: to.toDate(), days: Math.max(1, to.diff(from, "day") + 1) };
}

function formatBaseQuantity(value, unitBase) {
  const qty = Number(value || 0);
  if (unitBase === "ML") return qty >= 1000 ? `${round(qty / 1000, 1)} L` : `${round(qty, 0)} ml`;
  if (unitBase === "G") return qty >= 1000 ? `${round(qty / 1000, 1)} kg` : `${round(qty, 0)} g`;
  return `${round(qty, 0)} un`;
}

function getReservationCleaningDate(reservation) {
  return reservation.cleaningDateOverride || reservation.checkoutDate;
}

async function getAutomatedCleaningUsage(query = {}) {
  const { from, to } = getDateRange(query);
  const reservations = await prisma.reservation.findMany({
    where: {
      status: { not: "cancelada" },
      OR: [
        { cleaningDateOverride: { gte: from, lte: to } },
        {
          cleaningDateOverride: null,
          checkoutDate: { gte: from, lte: to },
        },
      ],
      ...(query.stayId ? { room: { stayId: String(query.stayId) } } : {}),
    },
    include: { room: { include: { stay: true } } },
    orderBy: { checkoutDate: "asc" },
  });

  const byStay = new Map();
  reservations.forEach((reservation) => {
    const stayId = reservation.room?.stayId;
    if (!stayId) return;
    const dateKey = dayjs(getReservationCleaningDate(reservation)).format("YYYY-MM-DD");
    if (!byStay.has(stayId)) {
      byStay.set(stayId, {
        stayId,
        stayName: reservation.room?.stay?.name || "Empreendimento",
        accommodationCleanings: 0,
        corridorDaysSet: new Set(),
        rooms: new Map(),
      });
    }
    const bucket = byStay.get(stayId);
    bucket.accommodationCleanings += 1;
    bucket.corridorDaysSet.add(dateKey);
    bucket.rooms.set(reservation.roomId, reservation.room?.title || "Acomodacao");
  });

  return [...byStay.values()].map((item) => ({
    stayId: item.stayId,
    stayName: item.stayName,
    accommodationCleanings: item.accommodationCleanings,
    corridorCleanings: item.corridorDaysSet.size,
    operationDays: item.corridorDaysSet.size,
    roomCount: item.rooms.size,
  }));
}

async function getConsumptionBaseline({ stayId, productId, operationType, before = new Date(), tx = prisma }) {
  const historyFrom = dayjs(before).subtract(HISTORY_DAYS, "day").toDate();
  const rows = await tx.productConsumption.findMany({
    where: {
      stayId,
      productId,
      operationType,
      occurredAt: { gte: historyFrom, lt: before },
    },
    orderBy: { occurredAt: "desc" },
    take: 80,
  });

  const values = rows.map((row) => Number(row.baseQuantity));
  const average = mean(values);
  const deviation = stddev(values);
  return {
    samples: rows.length,
    average,
    deviation,
    upperLimit: average ? Math.max(average * 1.45, average + deviation * 2) : null,
  };
}

async function decrementLots(tx, { stayId, productId, baseQuantity, lotId }) {
  let remaining = baseQuantity;
  let selectedLotId = lotId || null;

  const lots = lotId
    ? await tx.productLot.findMany({ where: { id: lotId } })
    : await tx.productLot.findMany({
        where: {
          stayId,
          productId,
          remainingQuantity: { gt: 0 },
          status: { in: ["OPEN", "SEALED"] },
        },
        orderBy: [{ status: "asc" }, { expiresAt: "asc" }, { createdAt: "asc" }],
      });

  for (const lot of lots) {
    if (remaining <= 0) break;
    const used = Math.min(Number(lot.remainingQuantity), remaining);
    remaining -= used;
    selectedLotId = selectedLotId || lot.id;
    const nextRemaining = Number(lot.remainingQuantity) - used;
    await tx.productLot.update({
      where: { id: lot.id },
      data: {
        remainingQuantity: nextRemaining,
        status: nextRemaining <= 0 ? "DEPLETED" : "OPEN",
        openedAt: lot.openedAt || new Date(),
        openedQuantity: lot.openedQuantity || lot.remainingQuantity,
      },
    });
  }

  return { lotId: selectedLotId, uncoveredQuantity: Math.max(0, remaining) };
}

async function registerProductEntry(data) {
  assertRequired(data, ["stayId", "productId", "quantity", "unit"]);
  const product = await prisma.product.findUnique({ where: { id: data.productId } });
  if (!product) {
    const error = new Error("Produto nao encontrado.");
    error.status = 404;
    throw error;
  }
  const unit = String(data.unit || "").trim().toLowerCase();
  const isPackageUnit = ["pct", "pacote", "pacotes", "galao", "galão", "galoes", "galões", "cx", "caixa", "caixas"].includes(unit);
  const normalized = isPackageUnit && product.packageBaseQuantity
    ? { unitBase: product.unitBase, baseValue: Number(data.quantity) * Number(product.packageBaseQuantity) }
    : normalizeQuantity(data.quantity, data.unit);
  const totalCost = data.totalCost !== undefined && data.totalCost !== "" ? Number(data.totalCost) : null;
  const unitCost = totalCost && normalized.baseValue > 0 ? totalCost / normalized.baseValue : null;
  const entryDate = data.entryDate ? new Date(data.entryDate) : new Date();
  const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

  return prisma.$transaction(async (tx) => {
    const lot = await tx.productLot.create({
      data: {
        stayId: data.stayId,
        productId: data.productId,
        code: data.lotCode || null,
        initialQuantity: normalized.baseValue,
        remainingQuantity: normalized.baseValue,
        expiresAt,
        notes: data.notes || null,
      },
    });

    const entry = await tx.productEntry.create({
      data: {
        stayId: data.stayId,
        productId: data.productId,
        lotId: lot.id,
        quantity: Number(data.quantity),
        unit: data.unit,
        baseQuantity: normalized.baseValue,
        supplier: data.supplier || null,
        totalCost,
        unitCost,
        entryDate,
        expiresAt,
        invoiceNumber: data.invoiceNumber || null,
        notes: data.notes || null,
      },
      include: { product: true, stay: true, lot: true },
    });

    await tx.inventory.upsert({
      where: { stayId_productId: { stayId: data.stayId, productId: data.productId } },
      update: {
        quantity: { increment: normalized.baseValue },
        capacity: { increment: normalized.baseValue },
      },
      create: {
        stayId: data.stayId,
        productId: data.productId,
        quantity: normalized.baseValue,
        capacity: normalized.baseValue,
      },
    });

    await tx.productInventorySnapshot.create({
      data: {
        stayId: data.stayId,
        productId: data.productId,
        quantity: normalized.baseValue,
        source: "entry",
        notes: data.notes || null,
      },
    });

    return entry;
  });
}

async function registerProductConsumption(data) {
  assertRequired(data, ["stayId", "productId", "quantity", "unit", "operationType"]);
  const normalized = normalizeQuantity(data.quantity, data.unit);
  const occurredAt = data.occurredAt ? new Date(data.occurredAt) : new Date();
  const baseline = await getConsumptionBaseline({
    stayId: data.stayId,
    productId: data.productId,
    operationType: data.operationType,
    before: occurredAt,
  });

  const anomalyScore = baseline.average > 0 ? normalized.baseValue / baseline.average : null;
  const isAnomaly = baseline.samples >= 4 && baseline.upperLimit && normalized.baseValue > baseline.upperLimit;
  const anomalyReason = isAnomaly
    ? `Uso ${round(anomalyScore, 2)}x acima da media historica para esta operacao.`
    : null;

  return prisma.$transaction(async (tx) => {
    const lotResult = await decrementLots(tx, {
      stayId: data.stayId,
      productId: data.productId,
      baseQuantity: normalized.baseValue,
      lotId: data.lotId || null,
    });

    const consumption = await tx.productConsumption.create({
      data: {
        stayId: data.stayId,
        productId: data.productId,
        lotId: lotResult.lotId,
        roomId: data.roomId || null,
        reservationId: data.reservationId || null,
        staffId: data.staffId || null,
        maidId: data.maidId ? Number(data.maidId) : null,
        operationType: data.operationType,
        location: data.location || null,
        quantity: Number(data.quantity),
        unit: data.unit,
        baseQuantity: normalized.baseValue,
        occurredAt,
        expectedQuantity: baseline.average || null,
        anomalyScore,
        anomalyReason,
        notes: data.notes || null,
      },
      include: { product: true, stay: true, room: true, staff: true, maid: true },
    });

    await tx.inventory.upsert({
      where: { stayId_productId: { stayId: data.stayId, productId: data.productId } },
      update: { quantity: { decrement: normalized.baseValue } },
      create: {
        stayId: data.stayId,
        productId: data.productId,
        quantity: -normalized.baseValue,
        capacity: 0,
      },
    });

    if (isAnomaly) {
      await tx.productAlert.create({
        data: {
          stayId: data.stayId,
          productId: data.productId,
          type: "HIGH_CONSUMPTION",
          severity: anomalyScore >= 2 ? "CRITICAL" : "WARNING",
          title: "Consumo acima do padrao",
          message: anomalyReason,
          metric: normalized.baseValue,
          baseline: baseline.average,
          metadata: {
            consumptionId: consumption.id,
            operationType: data.operationType,
            samples: baseline.samples,
          },
        },
      });
    }

    return consumption;
  });
}

async function listProductEntries(query = {}) {
  const { from, to } = getDateRange(query);
  return prisma.productEntry.findMany({
    where: {
      ...(query.stayId ? { stayId: String(query.stayId) } : {}),
      ...(query.productId ? { productId: String(query.productId) } : {}),
      entryDate: { gte: from, lte: to },
    },
    include: { product: true, stay: true, lot: true },
    orderBy: { entryDate: "desc" },
  });
}

async function listProductConsumptions(query = {}) {
  const { from, to } = getDateRange(query);
  return prisma.productConsumption.findMany({
    where: {
      ...(query.stayId ? { stayId: String(query.stayId) } : {}),
      ...(query.productId ? { productId: String(query.productId) } : {}),
      ...(query.operationType ? { operationType: String(query.operationType) } : {}),
      occurredAt: { gte: from, lte: to },
    },
    include: { product: true, stay: true, room: true, staff: true, maid: true, reservation: true },
    orderBy: { occurredAt: "desc" },
  });
}

async function registerLaundryDispatch(data) {
  assertRequired(data, ["stayId"]);
  const dispatchDate = data.dispatchDate ? new Date(data.dispatchDate) : new Date();
  const room = data.roomId
    ? await prisma.room.findUnique({ where: { id: data.roomId } })
    : null;
  const items = buildDefaultLaundryItems(
    room,
    Array.isArray(data.items) && data.items.length ? data.items : [],
  );

  return prisma.laundryDispatch.create({
    data: {
      stayId: data.stayId,
      roomId: data.roomId || null,
      reservationId: data.reservationId || null,
      maidId: data.maidId ? Number(data.maidId) : null,
      dispatchDate,
      expectedSets: Number(data.expectedSets || 2),
      notes: data.notes || null,
      items: {
        create: items
          .filter((item) => item.itemType && Number(item.quantity) >= 0)
          .map((item) => ({
            itemType: item.itemType,
            quantity: Math.max(0, Math.round(Number(item.quantity || 0))),
            unitPieces: Number(item.unitPieces || laundryPieces[item.itemType] || 1),
            notes: item.notes || null,
          })),
      },
    },
    include: { stay: true, room: true, maid: true, reservation: true, items: true },
  });
}

async function getCheckoutStats({ stayId, startedAt, endedAt }) {
  const [usage] = await getAutomatedCleaningUsage({ stayId, from: startedAt, to: endedAt });
  return {
    checkoutCount: usage?.accommodationCleanings || 0,
    corridorDays: usage?.corridorCleanings || 0,
  };
}

async function calculateUsageCycle(data) {
  assertRequired(data, ["stayId", "productId", "startedAt", "endedAt", "consumedQuantity"]);
  const product = await prisma.product.findUnique({ where: { id: data.productId } });
  if (!product) {
    const error = new Error("Produto nao encontrado.");
    error.status = 404;
    throw error;
  }

  const startedAt = new Date(data.startedAt);
  const endedAt = new Date(data.endedAt);
  const consumedQuantity = parsePositiveNumber(data.consumedQuantity, "consumedQuantity");
  const stats = await getCheckoutStats({ stayId: data.stayId, startedAt, endedAt });
  const corridorWeight = Number(product.corridorWeight ?? 1);
  const weightedOperations = stats.checkoutCount + stats.corridorDays * corridorWeight;
  const avgPerWeightedOperation = weightedOperations > 0 ? consumedQuantity / weightedOperations : null;
  const avgPerCheckout = stats.checkoutCount > 0 ? consumedQuantity / stats.checkoutCount : null;
  const avgPerCorridorDay = stats.corridorDays > 0 ? consumedQuantity / stats.corridorDays : null;

  const entry = data.lotId
    ? await prisma.productEntry.findFirst({ where: { lotId: data.lotId } })
    : await prisma.productEntry.findFirst({
        where: {
          stayId: data.stayId,
          productId: data.productId,
          entryDate: { gte: dayjs(startedAt).subtract(3, "day").toDate(), lte: endedAt },
        },
        orderBy: { entryDate: "asc" },
      });
  const costPerBase = entry?.unitCost ? Number(entry.unitCost) : null;

  return {
    stayId: data.stayId,
    productId: data.productId,
    lotId: data.lotId || null,
    startedAt,
    endedAt,
    consumedQuantity,
    checkoutCount: stats.checkoutCount,
    corridorDays: stats.corridorDays,
    weightedOperations,
    avgPerCheckout,
    avgPerCorridorDay,
    avgPerWeightedOperation,
    costPerCheckout: costPerBase && avgPerCheckout ? costPerBase * avgPerCheckout : null,
    notes: data.notes || null,
  };
}

async function createUsageCycle(data) {
  const cycle = await calculateUsageCycle(data);
  return prisma.productUsageCycle.create({
    data: cycle,
    include: { stay: true, product: true, lot: true },
  });
}

async function updateUsageCycle(id, data) {
  const existing = await prisma.productUsageCycle.findUnique({ where: { id } });
  if (!existing) {
    const error = new Error("Ciclo de consumo nao encontrado.");
    error.status = 404;
    throw error;
  }
  const recalculated = await calculateUsageCycle({
    stayId: data.stayId || existing.stayId,
    productId: data.productId || existing.productId,
    lotId: data.lotId !== undefined ? data.lotId : existing.lotId,
    startedAt: data.startedAt || existing.startedAt,
    endedAt: data.endedAt || existing.endedAt,
    consumedQuantity: data.consumedQuantity ?? existing.consumedQuantity,
    notes: data.notes ?? existing.notes,
  });
  return prisma.productUsageCycle.update({
    where: { id },
    data: recalculated,
    include: { stay: true, product: true, lot: true },
  });
}

async function listUsageCycles(query = {}) {
  const { from, to } = getDateRange(query);
  return prisma.productUsageCycle.findMany({
    where: {
      ...(query.stayId ? { stayId: String(query.stayId) } : {}),
      ...(query.productId ? { productId: String(query.productId) } : {}),
      startedAt: { lte: to },
      endedAt: { gte: from },
    },
    include: { stay: true, product: true, lot: true },
    orderBy: { endedAt: "desc" },
  });
}

async function depleteLotAndCreateCycle(lotId, data = {}) {
  const lot = await prisma.productLot.findUnique({
    where: { id: lotId },
    include: { product: true, stay: true },
  });
  if (!lot) {
    const error = new Error("Lote nao encontrado.");
    error.status = 404;
    throw error;
  }

  const remainingQuantity = data.remainingQuantity !== undefined
    ? Math.max(0, Number(data.remainingQuantity || 0))
    : 0;
  const consumedQuantity = data.consumedQuantity !== undefined
    ? parsePositiveNumber(data.consumedQuantity, "consumedQuantity")
    : Math.max(0, Number(lot.initialQuantity || 0) - remainingQuantity);
  const endedAt = data.depletedAt ? new Date(data.depletedAt) : new Date();
  const startedAt = data.startedAt
    ? new Date(data.startedAt)
    : lot.openedAt || lot.createdAt;
  const cycle = await calculateUsageCycle({
    stayId: lot.stayId,
    productId: lot.productId,
    lotId: lot.id,
    startedAt,
    endedAt,
    consumedQuantity,
    notes: data.notes || "Ciclo gerado ao fechar lote.",
  });

  return prisma.$transaction(async (tx) => {
    const existingCycle = await tx.productUsageCycle.findFirst({ where: { lotId: lot.id } });
    const savedCycle = existingCycle
      ? await tx.productUsageCycle.update({
          where: { id: existingCycle.id },
          data: cycle,
          include: { stay: true, product: true, lot: true },
        })
      : await tx.productUsageCycle.create({
          data: cycle,
          include: { stay: true, product: true, lot: true },
        });

    const updatedLot = await tx.productLot.update({
      where: { id: lot.id },
      data: {
        remainingQuantity,
        status: remainingQuantity > 0 ? "OPEN" : "DEPLETED",
        depletedAt: remainingQuantity > 0 ? null : endedAt,
        openedAt: lot.openedAt || startedAt,
      },
      include: { product: true, stay: true },
    });

    await tx.inventory.upsert({
      where: { stayId_productId: { stayId: lot.stayId, productId: lot.productId } },
      update: { quantity: { decrement: consumedQuantity } },
      create: {
        stayId: lot.stayId,
        productId: lot.productId,
        quantity: -consumedQuantity,
        capacity: Number(lot.initialQuantity || 0),
      },
    });

    await tx.productInventorySnapshot.create({
      data: {
        stayId: lot.stayId,
        productId: lot.productId,
        quantity: remainingQuantity,
        source: "usage_cycle",
        notes: data.notes || null,
      },
    });

    return { lot: updatedLot, cycle: savedCycle };
  });
}

async function listLaundryDispatches(query = {}) {
  const { from, to } = getDateRange(query);
  return prisma.laundryDispatch.findMany({
    where: {
      ...(query.stayId ? { stayId: String(query.stayId) } : {}),
      dispatchDate: { gte: from, lte: to },
    },
    include: { stay: true, room: true, maid: true, reservation: true, items: true },
    orderBy: { dispatchDate: "desc" },
  });
}

async function updateLaundryDispatch(id, data) {
  const items = Array.isArray(data.items) ? data.items : null;
  return prisma.$transaction(async (tx) => {
    if (items) {
      await tx.laundryDispatchItem.deleteMany({ where: { dispatchId: id } });
    }
    return tx.laundryDispatch.update({
      where: { id },
      data: {
        ...(data.roomId !== undefined ? { roomId: data.roomId || null } : {}),
        ...(data.reservationId !== undefined ? { reservationId: data.reservationId || null } : {}),
        ...(data.maidId !== undefined ? { maidId: data.maidId ? Number(data.maidId) : null } : {}),
        ...(data.dispatchDate ? { dispatchDate: new Date(data.dispatchDate) } : {}),
        ...(data.expectedSets !== undefined ? { expectedSets: Number(data.expectedSets || 0) } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        ...(items
          ? {
              items: {
                create: items.map((item) => ({
                  itemType: item.itemType,
                  quantity: Math.max(0, Math.round(Number(item.quantity || 0))),
                  unitPieces: Number(item.unitPieces || laundryPieces[item.itemType] || 1),
                  notes: item.notes || null,
                })),
              },
            }
          : {}),
      },
      include: { stay: true, room: true, maid: true, reservation: true, items: true },
    });
  });
}

function buildDailySeries(consumptions, days) {
  const byDay = new Map();
  for (let index = days - 1; index >= 0; index -= 1) {
    byDay.set(dayjs().subtract(index, "day").format("YYYY-MM-DD"), 0);
  }
  consumptions.forEach((item) => {
    const key = dayjs(item.occurredAt).format("YYYY-MM-DD");
    if (byDay.has(key)) byDay.set(key, byDay.get(key) + Number(item.baseQuantity || 0));
  });
  return [...byDay.entries()].map(([date, quantity]) => ({ date, quantity: round(quantity, 2) }));
}

function groupMetric(rows, keyFn, valueFn) {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyFn(row) || "Nao informado";
    map.set(key, (map.get(key) || 0) + Number(valueFn(row) || 0));
  });
  return [...map.entries()]
    .map(([name, value]) => ({ name, value: round(value, 2) }))
    .sort((a, b) => b.value - a.value);
}

function buildDynamicAlerts({ inventory, products, consumptions, entries, predictions, laundryDispatches, days }) {
  const alerts = [];
  const productById = new Map(products.map((product) => [product.id, product]));

  predictions.forEach((prediction) => {
    const product = productById.get(prediction.productId);
    if (prediction.currentStock < 0) {
      alerts.push({
        type: "NEGATIVE_STOCK",
        severity: "CRITICAL",
        title: "Estoque negativo",
        message: `${product?.name || "Produto"} esta com saldo abaixo de zero. Revise lancamentos ou compras pendentes.`,
        productId: prediction.productId,
      });
    } else if (prediction.daysRemaining !== null && prediction.daysRemaining <= CRITICAL_DAYS) {
      alerts.push({
        type: "LOW_STOCK",
        severity: "CRITICAL",
        title: "Reposicao urgente",
        message: `${product?.name || "Produto"} acabara em aproximadamente ${round(prediction.daysRemaining, 1)} dia(s).`,
        productId: prediction.productId,
      });
    } else if (prediction.daysRemaining !== null && prediction.daysRemaining <= WARNING_DAYS) {
      alerts.push({
        type: "REORDER_SUGGESTION",
        severity: "WARNING",
        title: "Planejar compra",
        message: `${product?.name || "Produto"} tem previsao de ${round(prediction.daysRemaining, 1)} dia(s) de estoque.`,
        productId: prediction.productId,
      });
    }
  });

  consumptions
    .filter((item) => Number(item.anomalyScore || 0) >= 1.45)
    .slice(0, 8)
    .forEach((item) => {
      alerts.push({
        type: "HIGH_CONSUMPTION",
        severity: item.anomalyScore >= 2 ? "CRITICAL" : "WARNING",
        title: "Consumo fora do padrao",
        message: `${item.product?.name || "Produto"} ficou ${round(item.anomalyScore, 1)}x acima da media em ${item.operationType}.`,
        productId: item.productId,
      });
    });

  const staffTotals = groupMetric(
    consumptions.filter((item) => item.staff || item.maid),
    (item) => item.staff?.name || item.maid?.name,
    (item) => item.baseQuantity,
  );
  const staffAverage = mean(staffTotals.map((item) => item.value));
  staffTotals
    .filter((item) => staffAverage > 0 && item.value > staffAverage * 1.45)
    .slice(0, 3)
    .forEach((item) => {
      alerts.push({
        type: "STAFF_OUTLIER",
        severity: "WARNING",
        title: "Funcionario acima da media",
        message: `${item.name} consumiu ${round(((item.value - staffAverage) / staffAverage) * 100, 0)}% acima da media da equipe no periodo.`,
      });
    });

  const oldThreshold = dayjs().subtract(60, "day");
  inventory.forEach((item) => {
    const lastConsumption = consumptions.find((row) => row.productId === item.productId);
    const lastEntry = entries.find((row) => row.productId === item.productId);
    if (Number(item.quantity || 0) > 0 && lastEntry && !lastConsumption && dayjs(lastEntry.entryDate).isBefore(oldThreshold)) {
      alerts.push({
        type: "STALE_PRODUCT",
        severity: "INFO",
        title: "Produto parado",
        message: `${item.product?.name || "Produto"} tem estoque, mas nao teve uso recente registrado.`,
        productId: item.productId,
      });
    }
  });

  const expiring = entries.filter((entry) => entry.expiresAt && dayjs(entry.expiresAt).diff(dayjs(), "day") <= 20);
  expiring.slice(0, 5).forEach((entry) => {
    alerts.push({
      type: "EXPIRING_PRODUCT",
      severity: "WARNING",
      title: "Validade proxima",
      message: `${entry.product?.name || "Produto"} vence em ${Math.max(0, dayjs(entry.expiresAt).diff(dayjs(), "day"))} dia(s).`,
      productId: entry.productId,
    });
  });

  const currentLaundry = laundryDispatches.filter((item) => dayjs(item.dispatchDate).isAfter(dayjs().subtract(7, "day")));
  const previousLaundry = laundryDispatches.filter((item) => dayjs(item.dispatchDate).isBefore(dayjs().subtract(7, "day")));
  const currentPieces = sum(currentLaundry.flatMap((item) => item.items), (item) => item.quantity * item.unitPieces);
  const previousPieces = sum(previousLaundry.flatMap((item) => item.items), (item) => item.quantity * item.unitPieces);
  const weeklyBaseline = previousPieces / Math.max(1, Math.ceil((days - 7) / 7));
  if (weeklyBaseline > 0 && currentPieces > weeklyBaseline * 1.8) {
    alerts.push({
      type: "LAUNDRY_SPIKE",
      severity: "WARNING",
      title: "Pico de lavanderia",
      message: `Lavanderia enviou ${round(currentPieces / weeklyBaseline, 1)}x mais pecas que a media semanal recente.`,
    });
  }

  return alerts.slice(0, 20);
}

async function buildInventoryDashboard(query = {}) {
  const { from, to, days } = getDateRange(query);
  const stayWhere = query.stayId ? { stayId: String(query.stayId) } : {};
  const futureTo = dayjs().add(30, "day").endOf("day").toDate();

  const [products, inventory, consumptions, entries, reservations, laundryDispatches, usageCycles, activeLots, persistedAlerts] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.inventory.findMany({ where: stayWhere, include: { product: true, stay: true } }),
    prisma.productConsumption.findMany({
      where: { ...stayWhere, occurredAt: { gte: dayjs(from).subtract(150, "day").toDate(), lte: to } },
      include: { product: true, stay: true, room: true, staff: true, maid: true },
      orderBy: { occurredAt: "desc" },
    }),
    prisma.productEntry.findMany({
      where: { ...stayWhere, entryDate: { gte: dayjs(from).subtract(150, "day").toDate(), lte: to } },
      include: { product: true, stay: true },
      orderBy: { entryDate: "desc" },
    }),
    prisma.reservation.findMany({
      where: {
        checkoutDate: { gte: from, lte: futureTo },
        status: { not: "cancelada" },
        ...(query.stayId ? { room: { stayId: String(query.stayId) } } : {}),
      },
      include: { room: true },
    }),
    prisma.laundryDispatch.findMany({
      where: { ...stayWhere, dispatchDate: { gte: dayjs(from).subtract(30, "day").toDate(), lte: to } },
      include: { items: true, room: true, maid: true },
      orderBy: { dispatchDate: "desc" },
    }),
    prisma.productUsageCycle.findMany({
      where: {
        ...(query.stayId ? { stayId: String(query.stayId) } : {}),
        startedAt: { lte: to },
        endedAt: { gte: dayjs(from).subtract(150, "day").toDate() },
      },
      include: { product: true, stay: true, lot: true },
      orderBy: { endedAt: "desc" },
    }),
    prisma.productLot.findMany({
      where: {
        ...(query.stayId ? { stayId: String(query.stayId) } : {}),
        status: { in: ["SEALED", "OPEN"] },
        remainingQuantity: { gt: 0 },
      },
      include: { product: true, stay: true },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.productAlert.findMany({
      where: { status: "open", ...(query.stayId ? { stayId: String(query.stayId) } : {}) },
      orderBy: { detectedAt: "desc" },
      take: 20,
    }),
  ]);

  const periodConsumptions = consumptions.filter((item) => dayjs(item.occurredAt).isAfter(dayjs(from).subtract(1, "millisecond")));
  const periodEntries = entries.filter((item) => dayjs(item.entryDate).isAfter(dayjs(from).subtract(1, "millisecond")));
  const productIds = new Set([...inventory.map((item) => item.productId), ...periodConsumptions.map((item) => item.productId)]);

  const predictions = [...productIds].map((productId) => {
    const product = products.find((item) => item.id === productId) || inventory.find((item) => item.productId === productId)?.product;
    const inv = inventory.find((item) => item.productId === productId);
    const productConsumptions = consumptions.filter((item) => item.productId === productId);
    const last30 = productConsumptions.filter((item) => dayjs(item.occurredAt).isAfter(dayjs().subtract(30, "day")));
    const last90 = productConsumptions.filter((item) => dayjs(item.occurredAt).isAfter(dayjs().subtract(90, "day")));
    const dailyAverage = (sum(last30, (item) => item.baseQuantity) / 30) || (sum(last90, (item) => item.baseQuantity) / 90);
    const futureReservations = reservations.filter((reservation) => reservation.room?.stayId === inv?.stayId || !query.stayId);
    const projectedReservationDemand = futureReservations.length ? dailyAverage * Math.min(1.25, 1 + futureReservations.length / 200) : dailyAverage;
    const currentStock = Number(inv?.quantity || 0);
    const daysRemaining = dailyAverage > 0 ? currentStock / dailyAverage : null;
    const recommendedQuantity = dailyAverage > 0
      ? Math.max(0, (product?.targetStock || dailyAverage * 30) - currentStock)
      : Math.max(0, Number(product?.targetStock || 0) - currentStock);
    return {
      stayId: inv?.stayId || query.stayId || null,
      productId,
      productName: product?.name || "Produto",
      unitBase: product?.unitBase || "UNIT",
      currentStock: round(currentStock, 2),
      currentStockLabel: formatBaseQuantity(currentStock, product?.unitBase),
      dailyAverage: round(dailyAverage, 2),
      daysRemaining: daysRemaining === null ? null : round(daysRemaining, 1),
      reorderDate: daysRemaining === null ? null : dayjs().add(Math.max(0, daysRemaining - 3), "day").format("YYYY-MM-DD"),
      recommendedQuantity: round(recommendedQuantity, 2),
      projectedDemand: round(projectedReservationDemand * 30, 2),
      confidence: Math.min(0.95, Math.max(0.25, productConsumptions.length / 30)),
    };
  });

  const costByProduct = groupMetric(
    periodConsumptions,
    (item) => item.product?.name,
    (item) => {
      const productEntries = entries.filter((entry) => entry.productId === item.productId && entry.unitCost);
      const avgCost = mean(productEntries.map((entry) => Number(entry.unitCost)));
      return avgCost * Number(item.baseQuantity || 0);
    },
  );
  const totalCost = sum(costByProduct, (item) => item.value);
  const reservationsInPeriod = reservations.filter((item) => dayjs(item.checkoutDate).isBefore(dayjs(to).add(1, "millisecond")));
  const guestCapacity = sum(reservationsInPeriod, (item) => item.room?.capacity || 1) || reservationsInPeriod.length || 1;
  const cleaningUsage = await getAutomatedCleaningUsage({ ...query, from, to });
  const activeLotProgress = await Promise.all(
    activeLots.map(async (lot) => {
      const startedAt = lot.openedAt || lot.createdAt;
      const [usage] = await getAutomatedCleaningUsage({
        stayId: lot.stayId,
        from: startedAt,
        to: new Date(),
      });
      const corridorWeight = Number(lot.product?.corridorWeight ?? 1);
      const weightedOperations =
        Number(usage?.accommodationCleanings || 0) +
        Number(usage?.corridorCleanings || 0) * corridorWeight;
      const learnedCycles = usageCycles.filter((cycle) => cycle.productId === lot.productId);
      const learnedAverage = mean(
        learnedCycles
          .map((cycle) => Number(cycle.avgPerWeightedOperation))
          .filter((value) => Number.isFinite(value) && value > 0)
      );
      const estimatedConsumed = learnedAverage > 0 ? learnedAverage * weightedOperations : null;
      return {
        lotId: lot.id,
        stayId: lot.stayId,
        stayName: lot.stay?.name,
        productId: lot.productId,
        productName: lot.product?.name,
        unitBase: lot.product?.unitBase,
        startedAt,
        initialQuantity: round(lot.initialQuantity, 2),
        remainingQuantity: round(lot.remainingQuantity, 2),
        accommodationCleanings: usage?.accommodationCleanings || 0,
        corridorCleanings: usage?.corridorCleanings || 0,
        weightedOperations: round(weightedOperations, 2),
        learnedAverage: learnedAverage ? round(learnedAverage, 2) : null,
        estimatedConsumed: estimatedConsumed === null ? null : round(estimatedConsumed, 2),
        estimatedRemaining: estimatedConsumed === null ? null : round(Number(lot.initialQuantity || 0) - estimatedConsumed, 2),
      };
    })
  );

  const dashboard = {
    period: { from, to, days },
    kpis: {
      activeProducts: products.length,
      criticalProducts: predictions.filter((item) => item.daysRemaining !== null && item.daysRemaining <= CRITICAL_DAYS).length,
      totalCost: round(totalCost, 2),
      costPerReservation: round(totalCost / Math.max(1, reservationsInPeriod.length), 2),
      costPerGuest: round(totalCost / Math.max(1, guestCapacity), 2),
      consumptionEvents: periodConsumptions.length,
      laundryPieces: sum(laundryDispatches.flatMap((item) => item.items), (item) => item.quantity * item.unitPieces),
      accommodationCleanings: sum(cleaningUsage, (item) => item.accommodationCleanings),
      corridorCleanings: sum(cleaningUsage, (item) => item.corridorCleanings),
    },
    inventory: inventory.map((item) => ({
      id: item.id,
      stayId: item.stayId,
      stayName: item.stay?.name,
      productId: item.productId,
      productName: item.product?.name,
      category: item.product?.category,
      quantity: round(item.quantity, 2),
      capacity: round(item.capacity, 2),
      unitBase: item.product?.unitBase,
      quantityLabel: formatBaseQuantity(item.quantity, item.product?.unitBase),
      availability: item.capacity > 0 ? round((item.quantity / item.capacity) * 100, 1) : null,
    })),
    predictions,
    cleaningUsage,
    activeLotProgress,
    alerts: [
      ...buildDynamicAlerts({
        inventory,
        products,
        consumptions: periodConsumptions,
        entries,
        predictions,
        laundryDispatches,
        days,
      }),
      ...persistedAlerts.map((alert) => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        productId: alert.productId,
      })),
    ].slice(0, 25),
    charts: {
      dailyConsumption: buildDailySeries(periodConsumptions, Math.min(days, 45)),
      byProduct: groupMetric(periodConsumptions, (item) => item.product?.name, (item) => item.baseQuantity).slice(0, 10),
      byOperation: groupMetric(periodConsumptions, (item) => item.operationType, (item) => item.baseQuantity),
      byRoom: groupMetric(periodConsumptions, (item) => item.room?.title || item.location, (item) => item.baseQuantity).slice(0, 10),
      byStaff: groupMetric(periodConsumptions, (item) => item.staff?.name || item.maid?.name, (item) => item.baseQuantity).slice(0, 10),
      costByProduct: costByProduct.slice(0, 10),
      learnedConsumption: groupMetric(
        usageCycles,
        (item) => item.product?.name,
        (item) => item.avgPerWeightedOperation || 0,
      ).slice(0, 10),
    },
    recent: {
      entries: periodEntries.slice(0, 12),
      consumptions: periodConsumptions.slice(0, 12),
      laundryDispatches: laundryDispatches.slice(0, 12),
      usageCycles: usageCycles.slice(0, 12),
      activeLotProgress: activeLotProgress.slice(0, 12),
    },
  };

  return dashboard;
}

module.exports = {
  buildInventoryDashboard,
  buildDefaultLaundryItems,
  createUsageCycle,
  depleteLotAndCreateCycle,
  formatBaseQuantity,
  getAutomatedCleaningUsage,
  laundryPieces,
  listLaundryDispatches,
  listProductConsumptions,
  listProductEntries,
  listUsageCycles,
  registerLaundryDispatch,
  registerProductConsumption,
  registerProductEntry,
  updateUsageCycle,
  updateLaundryDispatch,
};
