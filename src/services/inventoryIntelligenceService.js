const dayjs = require("dayjs");
const { prisma } = require("../prisma.js");
const {
  findRoomForCheckoutTask,
  makeRoomLookup,
  normalizeText,
} = require("./cleaningOperationsService");
const { toBaseUnit } = require("../utils/units.js");

const DEFAULT_WINDOW_DAYS = 30;
const HISTORY_DAYS = 180;
const CRITICAL_DAYS = 7;
const WARNING_DAYS = 14;
const SHARED_INVENTORY_STAY_NAMES = new Set([
  "iguatemi",
  "iguatemi stay",
  "iguatemi a",
  "iguatemi b",
  "iguatemi at",
  "iguatemi bt",
  "iguatemi c",
]);

const laundryPieces = {
  FITTED_SHEET: 1,
  TOP_SHEET: 1,
  PILLOWCASE: 1,
  SHEET_SET: 2,
  PILLOWCASE_SET: 2,
  BLANKET: 1,
  COMFORTER: 1,
  BEDSPREAD: 1,
  FACE_TOWEL: 1,
  BATH_TOWEL: 1,
  RUG: 1,
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
    COMFORTER: Number(template.COMFORTER ?? 0),
    BEDSPREAD: Number(template.BEDSPREAD ?? 0),
    FACE_TOWEL: Number(template.FACE_TOWEL ?? preparedBeds * 2),
    BATH_TOWEL: Number(template.BATH_TOWEL ?? preparedBeds * 2),
    RUG: Number(template.RUG ?? 0),
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

function parseCalendarDate(value, fallback = new Date()) {
  if (!value) return fallback;
  if (value instanceof Date) return value;

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  }

  return new Date(value);
}

function getDayRange(value) {
  const date = dayjs(value);
  return {
    from: date.startOf("day").toDate(),
    to: date.endOf("day").toDate(),
  };
}

function normalizeStayName(name) {
  return String(name || "").trim().toLowerCase();
}

function isSharedIguatemiStay(stay) {
  const normalized = normalizeStayName(stay?.name);
  return SHARED_INVENTORY_STAY_NAMES.has(normalized) || normalized.includes("iguatemi");
}

async function getInventoryStayScope(stayId) {
  const stays = await prisma.stay.findMany({ select: { id: true, name: true } });
  const sharedStays = stays.filter(isSharedIguatemiStay);
  const primaryStay = sharedStays.find((stay) => normalizeStayName(stay.name) === "iguatemi") || sharedStays[0] || null;
  const sharedStayIds = sharedStays.map((stay) => stay.id);

  if (!stayId) {
    return {
      isShared: false,
      aggregateSharedInAll: true,
      stockStayIds: null,
      stockWriteStayId: null,
      stockWhere: {},
      sharedStayIds,
      primarySharedStayId: primaryStay?.id || null,
      sharedLabel: "Estoque compartilhado",
    };
  }

  const selectedIsShared = sharedStays.some((stay) => stay.id === String(stayId));

  if (!selectedIsShared) {
    return {
      isShared: false,
      aggregateSharedInAll: false,
      stockStayIds: [String(stayId)],
      stockWriteStayId: String(stayId),
      stockWhere: { stayId: String(stayId) },
      sharedStayIds,
      primarySharedStayId: primaryStay?.id || null,
      sharedLabel: "Estoque compartilhado",
    };
  }

  return {
    isShared: true,
    aggregateSharedInAll: false,
    stockStayIds: sharedStayIds,
    stockWriteStayId: primaryStay.id,
    stockWhere: { stayId: { in: sharedStayIds } },
    sharedStayIds,
    primarySharedStayId: primaryStay.id,
    sharedLabel: "Iguatemi - estoque compartilhado",
  };
}

function aggregateSharedInventoryRows(rows, scope) {
  if (!scope.isShared && !scope.aggregateSharedInAll) return rows;
  const sharedSet = new Set(scope.sharedStayIds || []);
  const rowsToAggregate = scope.isShared ? rows : rows.filter((row) => sharedSet.has(row.stayId));
  const passthroughRows = scope.isShared ? [] : rows.filter((row) => !sharedSet.has(row.stayId));
  const byProduct = new Map();

  rowsToAggregate.forEach((row) => {
    const current = byProduct.get(row.productId);
    if (!current) {
      byProduct.set(row.productId, {
        ...row,
        id: `${scope.primarySharedStayId || row.stayId}:${row.productId}`,
        stayId: scope.primarySharedStayId || row.stayId,
        stay: { id: scope.primarySharedStayId || row.stayId, name: scope.sharedLabel },
        quantity: Number(row.quantity || 0),
        capacity: Number(row.capacity || 0),
      });
      return;
    }

    current.quantity += Number(row.quantity || 0);
    current.capacity += Number(row.capacity || 0);
  });

  return [...passthroughRows, ...byProduct.values()];
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

function buildCheckoutMaidMap(tasks, rooms) {
  const roomLookup = makeRoomLookup(rooms);
  const byRoomDay = new Map();

  tasks.forEach((task) => {
    if (!task.maidId) return;
    const room = findRoomForCheckoutTask(task, roomLookup);
    if (!room?.id) return;
    const dateKey = dayjs(task.date).format("YYYY-MM-DD");
    byRoomDay.set(`${room.id}|${dateKey}`, {
      maidId: task.maidId,
      maid: task.maid || null,
    });
  });

  return byRoomDay;
}

async function findLaundryAssignment({ roomId, reservationId, dispatchDate, tx = prisma }) {
  let room = null;
  let cleaningDate = dispatchDate;

  if (reservationId) {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: { room: { include: { stay: true } } },
    });
    if (reservation) {
      room = reservation.room || null;
      cleaningDate = getReservationCleaningDate(reservation);
    }
  }

  if (!room && roomId) {
    room = await tx.room.findUnique({
      where: { id: roomId },
      include: { stay: true },
    });
  }

  if (!room || !cleaningDate) return null;

  const { from, to } = getDayRange(cleaningDate);
  const tasks = await tx.task.findMany({
    where: {
      date: { gte: from, lte: to },
      maidId: { not: null },
    },
    include: { maid: true },
  });
  const roomTitle = normalizeText(room.title);
  const stayName = normalizeText(room.stay?.name);

  return tasks.find((task) => {
    const sameRoom = normalizeText(task.rooms) === roomTitle;
    const sameStay = !stayName || normalizeText(task.stay) === stayName;
    return sameRoom && sameStay;
  }) || tasks.find((task) => normalizeText(task.rooms) === roomTitle) || null;
}

async function backfillLaundryDispatchAssignments(dispatches = []) {
  return Promise.all(dispatches.map(async (dispatch) => {
    if (dispatch.maidId) return dispatch;

    const assignedTask = await findLaundryAssignment({
      roomId: dispatch.roomId,
      reservationId: dispatch.reservationId,
      dispatchDate: dispatch.dispatchDate,
    });
    if (!assignedTask?.maidId) return dispatch;

    await prisma.laundryDispatch.update({
      where: { id: dispatch.id },
      data: { maidId: assignedTask.maidId },
    });

    return {
      ...dispatch,
      maidId: assignedTask.maidId,
      maid: assignedTask.maid || dispatch.maid || null,
    };
  }));
}

function getLaundryItemLabel(itemType) {
  const labels = {
    FITTED_SHEET: "Lencol elastico",
    TOP_SHEET: "Lencol de cobrir",
    PILLOWCASE: "Fronha",
    BLANKET: "Manta",
    COMFORTER: "Cobertor",
    BEDSPREAD: "Colcha",
    FACE_TOWEL: "Toalha rosto",
    BATH_TOWEL: "Toalha banho",
    RUG: "Tapete",
    SHEET_SET: "Jogo de lencol",
    PILLOWCASE_SET: "Jogo de fronhas",
  };
  return labels[itemType] || itemType;
}

function addLaundryTotals(map, items) {
  items.forEach((item) => {
    if (!item.itemType) return;
    const current = map.get(item.itemType) || {
      itemType: item.itemType,
      label: getLaundryItemLabel(item.itemType),
      quantity: 0,
      pieces: 0,
    };
    const quantity = Number(item.quantity || 0);
    const unitPieces = Number(item.unitPieces || laundryPieces[item.itemType] || 1);
    current.quantity += quantity;
    current.pieces += quantity * unitPieces;
    map.set(item.itemType, current);
  });
}

async function getDailyOperationalSummary(query = {}) {
  const day = query.date ? dayjs(parseCalendarDate(query.date)) : dayjs();
  const from = day.startOf("day").toDate();
  const to = day.endOf("day").toDate();
  const stayId = query.stayId ? String(query.stayId) : null;
  const inventoryScope = await getInventoryStayScope(stayId);
  const stayRoomWhere = stayId
    ? inventoryScope.isShared
      ? { room: { stayId: { in: inventoryScope.stockStayIds } } }
      : { room: { stayId } }
    : {};
  const laundryStayWhere = stayId
    ? inventoryScope.isShared
      ? { stayId: { in: inventoryScope.stockStayIds } }
      : { stayId }
    : {};

  const [reservations, laundryDispatchRows, consumptions, alerts, checkoutTasks] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        status: { not: "cancelada" },
        OR: [
          { cleaningDateOverride: { gte: from, lte: to } },
          {
            cleaningDateOverride: null,
            checkoutDate: { gte: from, lte: to },
          },
        ],
        ...stayRoomWhere,
      },
      include: { guest: true, room: { include: { stay: true } } },
      orderBy: { checkoutDate: "asc" },
    }),
    prisma.laundryDispatch.findMany({
      where: {
        dispatchDate: { gte: from, lte: to },
        ...laundryStayWhere,
      },
      include: { items: true, room: true, maid: true, stay: true },
      orderBy: { dispatchDate: "asc" },
    }),
    prisma.productConsumption.findMany({
      where: {
        occurredAt: { gte: from, lte: to },
        ...inventoryScope.stockWhere,
      },
      include: { product: true },
    }),
    prisma.productAlert.findMany({
      where: {
        status: "open",
        detectedAt: { lte: to },
        ...inventoryScope.stockWhere,
      },
      orderBy: { detectedAt: "desc" },
      take: 10,
    }),
    prisma.task.findMany({
      where: {
        date: { gte: from, lte: to },
        maidId: { not: null },
      },
      include: { maid: true },
    }),
  ]);

  const laundryDispatches = await backfillLaundryDispatchAssignments(laundryDispatchRows);

  const expectedLaundryMap = new Map();
  reservations.forEach((reservation) => {
    addLaundryTotals(expectedLaundryMap, buildDefaultLaundryItems(reservation.room));
  });

  const sentLaundryMap = new Map();
  laundryDispatches.forEach((dispatch) => {
    addLaundryTotals(sentLaundryMap, dispatch.items || []);
  });
  const dispatchByReservation = new Map();
  const dispatchByRoom = new Map();
  laundryDispatches.forEach((dispatch) => {
    if (dispatch.reservationId) dispatchByReservation.set(dispatch.reservationId, dispatch);
    if (dispatch.roomId && !dispatchByRoom.has(dispatch.roomId)) dispatchByRoom.set(dispatch.roomId, dispatch);
  });
  const roomsForLookup = [...new Map(
    reservations
      .map((reservation) => reservation.room)
      .filter(Boolean)
      .map((room) => [room.id, room])
  ).values()];
  const checkoutMaidByRoomDay = buildCheckoutMaidMap(checkoutTasks, roomsForLookup);

  const mapReservationRoom = (reservation) => {
    const defaultItems = buildDefaultLaundryItems(reservation.room);
    const dispatch = dispatchByReservation.get(reservation.id) || dispatchByRoom.get(reservation.roomId) || null;
    const cleaningDate = getReservationCleaningDate(reservation);
    const checkoutAssignment = checkoutMaidByRoomDay.get(`${reservation.roomId}|${dayjs(cleaningDate).format("YYYY-MM-DD")}`) || null;
    return {
      reservationId: reservation.id,
      id: reservation.roomId,
      roomId: reservation.roomId,
      title: reservation.room?.title || "Acomodacao",
      imageUrl: reservation.room?.imageUrl || null,
      stayId: reservation.room?.stayId || null,
      stayName: reservation.room?.stay?.name || "",
      guestName: reservation.guest?.name || "",
      checkoutDate: reservation.checkoutDate,
      cleaningDate,
      maidId: dispatch?.maidId || checkoutAssignment?.maidId || null,
      maid: dispatch?.maid || checkoutAssignment?.maid || null,
      expectedItems: defaultItems.map((item) => ({
        ...item,
        label: getLaundryItemLabel(item.itemType),
      })),
      dispatch: dispatch ? {
        id: dispatch.id,
        maidId: dispatch.maidId,
        notes: dispatch.notes || "",
        dispatchDate: dispatch.dispatchDate,
        expectedSets: dispatch.expectedSets,
        items: (dispatch.items || []).map((item) => ({
          itemType: item.itemType,
          label: getLaundryItemLabel(item.itemType),
          quantity: item.quantity,
          unitPieces: item.unitPieces,
          notes: item.notes || "",
        })),
      } : null,
    };
  };

  const byStay = new Map();
  reservations.forEach((reservation) => {
    const stay = reservation.room?.stay;
    const key = stay?.id || "none";
    if (!byStay.has(key)) {
      byStay.set(key, {
        stayId: stay?.id || null,
        stayName: stay?.name || "Sem empreendimento",
        accommodationCleanings: 0,
        corridorCleanings: 0,
        corridorDates: new Set(),
        rooms: [],
      });
    }
    const bucket = byStay.get(key);
    const cleaningDate = dayjs(getReservationCleaningDate(reservation)).format("YYYY-MM-DD");
    bucket.accommodationCleanings += 1;
    bucket.corridorDates.add(cleaningDate);
    bucket.rooms.push(mapReservationRoom(reservation));
  });

  const stays = [...byStay.values()].map((item) => ({
    ...item,
    corridorCleanings: item.corridorDates.size,
    corridorDates: undefined,
  }));

  const productUsage = [...new Map(consumptions.map((item) => [item.productId, {
    productId: item.productId,
    productName: item.product?.name || "Produto",
    unitBase: item.product?.unitBase || "UNIT",
    quantity: 0,
  }])).values()];
  productUsage.forEach((product) => {
    product.quantity = sum(
      consumptions.filter((item) => item.productId === product.productId),
      (item) => item.baseQuantity,
    );
    product.quantityLabel = formatBaseQuantity(product.quantity, product.unitBase);
  });

  const expectedLaundry = [...expectedLaundryMap.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  const sentLaundry = [...sentLaundryMap.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

  return {
    date: day.format("YYYY-MM-DD"),
    accommodationCleanings: reservations.length,
    corridorCleanings: stays.reduce((total, item) => total + item.corridorCleanings, 0),
    rooms: reservations.map(mapReservationRoom),
    stays,
    laundry: {
      expected: expectedLaundry,
      sent: sentLaundry,
      expectedPieces: sum(expectedLaundry, (item) => item.pieces),
      sentPieces: sum(sentLaundry, (item) => item.pieces),
      dispatches: laundryDispatches.length,
    },
    alerts: alerts.map((alert) => ({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
    })),
    productUsage,
  };
}

async function getAutomatedCleaningUsage(query = {}) {
  const { from, to } = getDateRange(query);
  const stayFilter = Array.isArray(query.stayIds) && query.stayIds.length
    ? { room: { stayId: { in: query.stayIds.map(String) } } }
    : query.stayId ? { room: { stayId: String(query.stayId) } } : {};
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
      ...stayFilter,
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
  const scope = await getInventoryStayScope(data.stayId);
  const stockStayId = scope.stockWriteStayId || data.stayId;
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
  const entryDate = data.entryDate ? parseCalendarDate(data.entryDate) : new Date();
  const expiresAt = data.expiresAt ? parseCalendarDate(data.expiresAt) : null;

  return prisma.$transaction(async (tx) => {
    const lot = await tx.productLot.create({
      data: {
        stayId: stockStayId,
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
        stayId: stockStayId,
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
      where: { stayId_productId: { stayId: stockStayId, productId: data.productId } },
      update: {
        quantity: { increment: normalized.baseValue },
        capacity: { increment: normalized.baseValue },
      },
      create: {
        stayId: stockStayId,
        productId: data.productId,
        quantity: normalized.baseValue,
        capacity: normalized.baseValue,
      },
    });

    await tx.productInventorySnapshot.create({
      data: {
        stayId: stockStayId,
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
  const scope = await getInventoryStayScope(data.stayId);
  const stockStayId = scope.stockWriteStayId || data.stayId;
  const normalized = normalizeQuantity(data.quantity, data.unit);
  const occurredAt = data.occurredAt ? new Date(data.occurredAt) : new Date();
  const baseline = await getConsumptionBaseline({
    stayId: stockStayId,
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
      stayId: stockStayId,
      productId: data.productId,
      baseQuantity: normalized.baseValue,
      lotId: data.lotId || null,
    });

    const consumption = await tx.productConsumption.create({
      data: {
        stayId: stockStayId,
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
      where: { stayId_productId: { stayId: stockStayId, productId: data.productId } },
      update: { quantity: { decrement: normalized.baseValue } },
      create: {
        stayId: stockStayId,
        productId: data.productId,
        quantity: -normalized.baseValue,
        capacity: 0,
      },
    });

    if (isAnomaly) {
      await tx.productAlert.create({
        data: {
          stayId: stockStayId,
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
  const scope = await getInventoryStayScope(query.stayId);
  return prisma.productEntry.findMany({
    where: {
      ...scope.stockWhere,
      ...(query.productId ? { productId: String(query.productId) } : {}),
      entryDate: { gte: from, lte: to },
    },
    include: { product: true, stay: true, lot: true },
    orderBy: { entryDate: "desc" },
  });
}

async function updateProductEntry(id, data) {
  const current = await prisma.productEntry.findUnique({ where: { id }, include: { lot: true } });
  if (!current) {
    const error = new Error("Entrada nao encontrada.");
    error.status = 404;
    throw error;
  }

  const quantity = data.quantity !== undefined ? Number(data.quantity) : current.quantity;
  const unit = data.unit || current.unit;
  const normalized = data.quantity !== undefined || data.unit !== undefined
    ? normalizeQuantity(quantity, unit)
    : { baseValue: current.baseQuantity };
  const diff = Number(normalized.baseValue || 0) - Number(current.baseQuantity || 0);
  const totalCost = data.totalCost !== undefined && data.totalCost !== "" ? Number(data.totalCost) : current.totalCost;
  const unitCost = totalCost && normalized.baseValue > 0 ? totalCost / normalized.baseValue : null;

  return prisma.$transaction(async (tx) => {
    const entry = await tx.productEntry.update({
      where: { id },
      data: {
        ...(data.quantity !== undefined ? { quantity } : {}),
        ...(data.unit !== undefined ? { unit } : {}),
        baseQuantity: normalized.baseValue,
        ...(data.supplier !== undefined ? { supplier: data.supplier || null } : {}),
        ...(data.totalCost !== undefined ? { totalCost, unitCost } : {}),
        ...(data.entryDate ? { entryDate: parseCalendarDate(data.entryDate) } : {}),
        ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt ? parseCalendarDate(data.expiresAt) : null } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      },
      include: { product: true, stay: true, lot: true },
    });

    if (diff !== 0) {
      await tx.inventory.update({
        where: { stayId_productId: { stayId: current.stayId, productId: current.productId } },
        data: { quantity: { increment: diff }, capacity: { increment: diff } },
      }).catch(() => null);
      if (current.lotId) {
        await tx.productLot.update({
          where: { id: current.lotId },
          data: { initialQuantity: { increment: diff }, remainingQuantity: { increment: diff } },
        }).catch(() => null);
      }
    }

    return entry;
  });
}

async function deleteProductEntry(id) {
  const current = await prisma.productEntry.findUnique({ where: { id } });
  if (!current) {
    const error = new Error("Entrada nao encontrada.");
    error.status = 404;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    if (current.lotId) await tx.productLot.delete({ where: { id: current.lotId } }).catch(() => null);
    await tx.productEntry.delete({ where: { id } });
    await tx.inventory.update({
      where: { stayId_productId: { stayId: current.stayId, productId: current.productId } },
      data: { quantity: { decrement: current.baseQuantity }, capacity: { decrement: current.baseQuantity } },
    }).catch(() => null);
    return { deleted: true, id };
  });
}

async function listProductConsumptions(query = {}) {
  const { from, to } = getDateRange(query);
  const scope = await getInventoryStayScope(query.stayId);
  return prisma.productConsumption.findMany({
    where: {
      ...scope.stockWhere,
      ...(query.productId ? { productId: String(query.productId) } : {}),
      ...(query.operationType ? { operationType: String(query.operationType) } : {}),
      occurredAt: { gte: from, lte: to },
    },
    include: { product: true, stay: true, room: true, staff: true, maid: true, reservation: true },
    orderBy: { occurredAt: "desc" },
  });
}

async function updateProductConsumption(id, data) {
  const current = await prisma.productConsumption.findUnique({ where: { id } });
  if (!current) {
    const error = new Error("Consumo nao encontrado.");
    error.status = 404;
    throw error;
  }

  const quantity = data.quantity !== undefined ? Number(data.quantity) : current.quantity;
  const unit = data.unit || current.unit;
  const normalized = data.quantity !== undefined || data.unit !== undefined
    ? normalizeQuantity(quantity, unit)
    : { baseValue: current.baseQuantity };
  const diff = Number(normalized.baseValue || 0) - Number(current.baseQuantity || 0);

  return prisma.$transaction(async (tx) => {
    const consumption = await tx.productConsumption.update({
      where: { id },
      data: {
        ...(data.quantity !== undefined ? { quantity } : {}),
        ...(data.unit !== undefined ? { unit } : {}),
        baseQuantity: normalized.baseValue,
        ...(data.operationType ? { operationType: data.operationType } : {}),
        ...(data.location !== undefined ? { location: data.location || null } : {}),
        ...(data.occurredAt ? { occurredAt: new Date(data.occurredAt) } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      },
      include: { product: true, stay: true, room: true, staff: true, maid: true, reservation: true },
    });

    if (diff !== 0) {
      await tx.inventory.update({
        where: { stayId_productId: { stayId: current.stayId, productId: current.productId } },
        data: { quantity: { decrement: diff } },
      }).catch(() => null);
      if (current.lotId) {
        await tx.productLot.update({
          where: { id: current.lotId },
          data: { remainingQuantity: { decrement: diff } },
        }).catch(() => null);
      }
    }

    return consumption;
  });
}

async function deleteProductConsumption(id) {
  const current = await prisma.productConsumption.findUnique({ where: { id } });
  if (!current) {
    const error = new Error("Consumo nao encontrado.");
    error.status = 404;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    await tx.productConsumption.delete({ where: { id } });
    await tx.inventory.update({
      where: { stayId_productId: { stayId: current.stayId, productId: current.productId } },
      data: { quantity: { increment: current.baseQuantity } },
    }).catch(() => null);
    if (current.lotId) {
      await tx.productLot.update({
        where: { id: current.lotId },
        data: { remainingQuantity: { increment: current.baseQuantity } },
      }).catch(() => null);
    }
    return { deleted: true, id };
  });
}

async function registerLaundryDispatch(data) {
  assertRequired(data, ["stayId"]);
  const dispatchDate = data.dispatchDate ? parseCalendarDate(data.dispatchDate) : new Date();
  const room = data.roomId
    ? await prisma.room.findUnique({ where: { id: data.roomId } })
    : null;
  const items = buildDefaultLaundryItems(
    room,
    Array.isArray(data.items) && data.items.length ? data.items : [],
  );
  const assignedTask = data.maidId
    ? null
    : await findLaundryAssignment({
      roomId: data.roomId,
      reservationId: data.reservationId,
      dispatchDate,
    });

  return prisma.laundryDispatch.create({
    data: {
      stayId: data.stayId,
      roomId: data.roomId || null,
      reservationId: data.reservationId || null,
      maidId: data.maidId ? Number(data.maidId) : assignedTask?.maidId || null,
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

async function getCheckoutStats({ stayId, stayIds, startedAt, endedAt }) {
  const usageRows = await getAutomatedCleaningUsage({ stayId, stayIds, from: startedAt, to: endedAt });
  const usage = {
    accommodationCleanings: sum(usageRows, (item) => item.accommodationCleanings),
    corridorCleanings: sum(usageRows, (item) => item.corridorCleanings),
  };
  return {
    checkoutCount: usage.accommodationCleanings || 0,
    corridorDays: usage.corridorCleanings || 0,
  };
}

async function calculateUsageCycle(data) {
  assertRequired(data, ["stayId", "productId", "startedAt", "endedAt", "consumedQuantity"]);
  const scope = await getInventoryStayScope(data.stayId);
  const stockStayId = scope.stockWriteStayId || data.stayId;
  const product = await prisma.product.findUnique({ where: { id: data.productId } });
  if (!product) {
    const error = new Error("Produto nao encontrado.");
    error.status = 404;
    throw error;
  }

  const startedAt = parseCalendarDate(data.startedAt);
  const endedAt = parseCalendarDate(data.endedAt);
  const consumedQuantity = parsePositiveNumber(data.consumedQuantity, "consumedQuantity");
  const stats = await getCheckoutStats({
    stayId: data.stayId,
    stayIds: scope.isShared ? scope.stockStayIds : null,
    startedAt,
    endedAt,
  });
  const corridorWeight = Number(product.corridorWeight ?? 1);
  const weightedOperations = stats.checkoutCount + stats.corridorDays * corridorWeight;
  const avgPerWeightedOperation = weightedOperations > 0 ? consumedQuantity / weightedOperations : null;
  const avgPerCheckout = stats.checkoutCount > 0 ? consumedQuantity / stats.checkoutCount : null;
  const avgPerCorridorDay = stats.corridorDays > 0 ? consumedQuantity / stats.corridorDays : null;

  const entry = data.lotId
    ? await prisma.productEntry.findFirst({ where: { lotId: data.lotId } })
    : await prisma.productEntry.findFirst({
      where: {
        ...(scope.isShared ? { stayId: { in: scope.stockStayIds } } : { stayId: stockStayId }),
        productId: data.productId,
        entryDate: { gte: dayjs(startedAt).subtract(3, "day").toDate(), lte: endedAt },
      },
      orderBy: { entryDate: "asc" },
    });
  const costPerBase = entry?.unitCost ? Number(entry.unitCost) : null;

  return {
    stayId: stockStayId,
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

async function deleteUsageCycle(id) {
  await prisma.productUsageCycle.delete({ where: { id } });
  return { deleted: true, id };
}

async function listUsageCycles(query = {}) {
  const { from, to } = getDateRange(query);
  const scope = await getInventoryStayScope(query.stayId);
  return prisma.productUsageCycle.findMany({
    where: {
      ...scope.stockWhere,
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
  const endedAt = data.depletedAt ? parseCalendarDate(data.depletedAt) : new Date();
  const startedAt = data.startedAt
    ? parseCalendarDate(data.startedAt)
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
  const previousCycles = await prisma.productUsageCycle.findMany({
    where: {
      stayId: cycle.stayId,
      productId: cycle.productId,
      ...(lot.id ? { lotId: { not: lot.id } } : {}),
      avgPerWeightedOperation: { not: null },
    },
    orderBy: { endedAt: "desc" },
    take: 12,
  });
  const previousAverage = mean(
    previousCycles
      .map((item) => Number(item.avgPerWeightedOperation))
      .filter((value) => Number.isFinite(value) && value > 0),
  );
  const currentAverage = Number(cycle.avgPerWeightedOperation || 0);
  const variationPct = previousAverage > 0 && currentAverage > 0
    ? ((currentAverage - previousAverage) / previousAverage) * 100
    : null;

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
        openedQuantity: lot.openedQuantity || lot.initialQuantity,
      },
      include: { product: true, stay: true },
    });

    let nextLot = null;
    if (remainingQuantity <= 0) {
      nextLot = await tx.productLot.findFirst({
        where: {
          id: { not: lot.id },
          stayId: lot.stayId,
          productId: lot.productId,
          status: "SEALED",
          remainingQuantity: { gt: 0 },
        },
        orderBy: [{ createdAt: "asc" }],
      });
      if (nextLot) {
        nextLot = await tx.productLot.update({
          where: { id: nextLot.id },
          data: {
            status: "OPEN",
            openedAt: endedAt,
            openedQuantity: nextLot.openedQuantity || nextLot.initialQuantity,
          },
          include: { product: true, stay: true },
        });
      }
    }

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

    if (variationPct !== null && Math.abs(variationPct) > 20) {
      await tx.productAlert.create({
        data: {
          stayId: cycle.stayId,
          productId: cycle.productId,
          type: "HIGH_CONSUMPTION",
          severity: Math.abs(variationPct) > 40 ? "CRITICAL" : "WARNING",
          title: "Variacao de consumo",
          message: `${lot.product?.name || "Produto"} variou ${round(variationPct, 1)}% contra a media dos ciclos anteriores.`,
          metric: currentAverage,
          baseline: previousAverage,
          metadata: {
            cycleId: savedCycle.id,
            lotId: lot.id,
            variationPct: round(variationPct, 2),
          },
        },
      });
    }

    return { lot: updatedLot, nextLot, cycle: savedCycle };
  });
}

async function listLaundryDispatches(query = {}) {
  const { from, to } = getDateRange(query);
  const dispatches = await prisma.laundryDispatch.findMany({
    where: {
      ...(query.stayId ? { stayId: String(query.stayId) } : {}),
      dispatchDate: { gte: from, lte: to },
    },
    include: { stay: true, room: true, maid: true, reservation: true, items: true },
    orderBy: { dispatchDate: "desc" },
  });
  return backfillLaundryDispatchAssignments(dispatches);
}

async function listLaundryItemPrices() {
  const prices = await prisma.laundryItemPrice.findMany({ orderBy: { itemType: "asc" } });
  const byType = new Map(prices.map((item) => [item.itemType, item]));

  return Object.keys(laundryPieces).map((itemType) => {
    const price = byType.get(itemType);
    return {
      id: price?.id || null,
      itemType,
      label: getLaundryItemLabel(itemType),
      price: price ? Number(price.price || 0) : 0,
      notes: price?.notes || "",
    };
  });
}

async function upsertLaundryItemPrices(items = []) {
  if (!Array.isArray(items)) {
    const error = new Error("Lista de valores invalida.");
    error.status = 400;
    throw error;
  }

  const saved = await prisma.$transaction(
    items
      .filter((item) => item?.itemType && Object.prototype.hasOwnProperty.call(laundryPieces, item.itemType))
      .map((item) => prisma.laundryItemPrice.upsert({
        where: { itemType: item.itemType },
        update: {
          price: Number(item.price || 0),
          notes: item.notes || null,
        },
        create: {
          itemType: item.itemType,
          price: Number(item.price || 0),
          notes: item.notes || null,
        },
      })),
  );

  const savedTypes = new Set(saved.map((item) => item.itemType));
  const missingTypes = Object.keys(laundryPieces).filter((itemType) => !savedTypes.has(itemType));
  if (missingTypes.length) {
    await prisma.$transaction(missingTypes.map((itemType) => prisma.laundryItemPrice.upsert({
      where: { itemType },
      update: {},
      create: { itemType, price: 0 },
    })));
  }

  return listLaundryItemPrices();
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
        ...(data.dispatchDate ? { dispatchDate: parseCalendarDate(data.dispatchDate) } : {}),
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

async function deleteLaundryDispatch(id) {
  await prisma.laundryDispatch.delete({ where: { id } });
  return { deleted: true, id };
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
  const inventoryScope = await getInventoryStayScope(query.stayId);
  const stayWhere = inventoryScope.stockWhere;
  const reservationStayWhere = query.stayId
    ? inventoryScope.isShared
      ? { room: { stayId: { in: inventoryScope.stockStayIds } } }
      : { room: { stayId: String(query.stayId) } }
    : {};
  const futureTo = dayjs().add(30, "day").endOf("day").toDate();
  const today = query.today || query.date || dayjs().format("YYYY-MM-DD");

  const [products, inventory, consumptions, entries, reservations, laundryDispatchRows, laundryPrices, usageCycles, activeLots, persistedAlerts] = await Promise.all([
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
        ...reservationStayWhere,
      },
      include: { room: true },
    }),
    prisma.laundryDispatch.findMany({
      where: { ...stayWhere, dispatchDate: { gte: dayjs(from).subtract(30, "day").toDate(), lte: to } },
      include: { items: true, room: true, maid: true },
      orderBy: { dispatchDate: "desc" },
    }),
    prisma.laundryItemPrice.findMany(),
    prisma.productUsageCycle.findMany({
      where: {
        ...stayWhere,
        startedAt: { lte: to },
        endedAt: { gte: dayjs(from).subtract(150, "day").toDate() },
      },
      include: { product: true, stay: true, lot: true },
      orderBy: { endedAt: "desc" },
    }),
    prisma.productLot.findMany({
      where: {
        ...stayWhere,
        status: { in: ["SEALED", "OPEN"] },
        remainingQuantity: { gt: 0 },
      },
      include: { product: true, stay: true },
      orderBy: [{ status: "asc" }, { openedAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.productAlert.findMany({
      where: { status: "open", ...stayWhere },
      orderBy: { detectedAt: "desc" },
      take: 20,
    }),
  ]);

  const laundryDispatches = await backfillLaundryDispatchAssignments(laundryDispatchRows);
  const inventoryRows = aggregateSharedInventoryRows(inventory, inventoryScope);
  const periodConsumptions = consumptions.filter((item) => dayjs(item.occurredAt).isAfter(dayjs(from).subtract(1, "millisecond")));
  const periodEntries = entries.filter((item) => dayjs(item.entryDate).isAfter(dayjs(from).subtract(1, "millisecond")));
  const periodLaundryDispatches = laundryDispatches.filter((item) => dayjs(item.dispatchDate).isAfter(dayjs(from).subtract(1, "millisecond")));
  const productIds = new Set([...inventoryRows.map((item) => item.productId), ...periodConsumptions.map((item) => item.productId)]);

  const predictions = [...productIds].map((productId) => {
    const product = products.find((item) => item.id === productId) || inventoryRows.find((item) => item.productId === productId)?.product;
    const inv = inventoryRows.find((item) => item.productId === productId);
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
  const productConsumptionCost = sum(costByProduct, (item) => item.value);
  const laundryPriceByType = new Map(laundryPrices.map((item) => [item.itemType, Number(item.price || 0)]));
  const laundryCost = sum(
    periodLaundryDispatches.flatMap((item) => item.items || []),
    (item) => Number(item.quantity || 0) * Number(laundryPriceByType.get(item.itemType) || 0),
  );
  const totalCost = productConsumptionCost + laundryCost;
  const bedLinenTypes = new Set(["FITTED_SHEET", "TOP_SHEET"]);
  const bathLinenTypes = new Set(["FACE_TOWEL", "BATH_TOWEL"]);
  const laundryMonthlySummary = [...periodLaundryDispatches.reduce((map, dispatch) => {
    const month = dayjs(dispatch.dispatchDate).format("YYYY-MM");
    const current = map.get(month) || {
      id: month,
      month,
      monthLabel: dayjs(dispatch.dispatchDate).format("MM/YYYY"),
      dispatches: 0,
      pieces: 0,
      bedLinen: 0,
      bathLinen: 0,
      cost: 0,
      accommodations: 0,
      maidIds: new Set(),
    };

    const dispatchPieces = sum(dispatch.items || [], (item) => Number(item.quantity || 0) * Number(item.unitPieces || 1));
    const dispatchBedLinen = sum(
      (dispatch.items || []).filter((item) => bedLinenTypes.has(item.itemType)),
      (item) => Number(item.quantity || 0) * Number(item.unitPieces || 1),
    );
    const dispatchBathLinen = sum(
      (dispatch.items || []).filter((item) => bathLinenTypes.has(item.itemType)),
      (item) => Number(item.quantity || 0) * Number(item.unitPieces || 1),
    );
    const dispatchCost = sum(
      dispatch.items || [],
      (item) => Number(item.quantity || 0) * Number(laundryPriceByType.get(item.itemType) || 0),
    );

    current.dispatches += 1;
    current.pieces += dispatchPieces;
    current.bedLinen += dispatchBedLinen;
    current.bathLinen += dispatchBathLinen;
    current.cost += dispatchCost;
    current.accommodations += 1;
    if (dispatch.maidId) current.maidIds.add(dispatch.maidId);
    map.set(month, current);
    return map;
  }, new Map()).values()]
    .map((item) => ({
      id: item.id,
      month: item.month,
      monthLabel: item.monthLabel,
      dispatches: item.dispatches,
      rooms: item.accommodations,
      maids: item.maidIds.size,
      bedLinen: round(item.bedLinen, 2),
      bathLinen: round(item.bathLinen, 2),
      pieces: round(item.pieces, 2),
      cost: round(item.cost, 2),
      avgPiecesPerDispatch: round(item.pieces / Math.max(1, item.dispatches), 1),
      avgCostPerDispatch: round(item.cost / Math.max(1, item.dispatches), 2),
    }))
    .sort((a, b) => b.month.localeCompare(a.month));
  const reservationsInPeriod = reservations.filter((item) => dayjs(item.checkoutDate).isBefore(dayjs(to).add(1, "millisecond")));
  const guestCapacity = sum(reservationsInPeriod, (item) => item.room?.capacity || 1) || reservationsInPeriod.length || 1;
  const [cleaningUsage, todaySummary] = await Promise.all([
    getAutomatedCleaningUsage({ ...query, from, to }),
    getDailyOperationalSummary({ stayId: query.stayId, date: today }),
  ]);
  const activeLotProgress = await Promise.all(
    activeLots.map(async (lot) => {
      const startedAt = lot.openedAt || lot.createdAt;
      const usageRows = await getAutomatedCleaningUsage({
        stayId: lot.stayId,
        stayIds: inventoryScope.isShared ? inventoryScope.stockStayIds : null,
        from: startedAt,
        to: new Date(),
      });
      const usage = {
        accommodationCleanings: sum(usageRows, (item) => item.accommodationCleanings),
        corridorCleanings: sum(usageRows, (item) => item.corridorCleanings),
      };
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
      const entry = entries.find((row) => row.lotId === lot.id) || entries.find((row) => row.productId === lot.productId && row.unitCost);
      const estimatedCost = estimatedConsumed !== null && entry?.unitCost
        ? estimatedConsumed * Number(entry.unitCost)
        : null;
      const durationDays = Math.max(1, dayjs().diff(dayjs(startedAt), "day") + 1);
      return {
        lotId: lot.id,
        stayId: lot.stayId,
        stayName: lot.stay?.name,
        productId: lot.productId,
        productName: lot.product?.name,
        unitBase: lot.product?.unitBase,
        startedAt,
        openedAt: lot.openedAt,
        status: lot.status,
        durationDays,
        initialQuantity: round(lot.initialQuantity, 2),
        remainingQuantity: round(lot.remainingQuantity, 2),
        remainingPercent: lot.initialQuantity > 0 ? round((Number(lot.remainingQuantity || 0) / Number(lot.initialQuantity || 1)) * 100, 1) : null,
        accommodationCleanings: usage?.accommodationCleanings || 0,
        corridorCleanings: usage?.corridorCleanings || 0,
        weightedOperations: round(weightedOperations, 2),
        learnedAverage: learnedAverage ? round(learnedAverage, 2) : null,
        estimatedConsumed: estimatedConsumed === null ? null : round(estimatedConsumed, 2),
        estimatedCost: estimatedCost === null ? null : round(estimatedCost, 2),
        unitCost: entry?.unitCost ? round(entry.unitCost, 4) : null,
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
      productConsumptionCost: round(productConsumptionCost, 2),
      laundryCost: round(laundryCost, 2),
      laundryPieces: sum(periodLaundryDispatches.flatMap((item) => item.items || []), (item) => item.quantity * item.unitPieces),
      accommodationCleanings: sum(cleaningUsage, (item) => item.accommodationCleanings),
      corridorCleanings: sum(cleaningUsage, (item) => item.corridorCleanings),
    },
    inventory: inventoryRows.map((item) => ({
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
    todaySummary,
    laundryMonthlySummary,
    predictions,
    cleaningUsage,
    activeLotProgress,
    alerts: [
      ...buildDynamicAlerts({
        inventory: inventoryRows,
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
  deleteLaundryDispatch,
  deleteProductConsumption,
  deleteProductEntry,
  deleteUsageCycle,
  depleteLotAndCreateCycle,
  formatBaseQuantity,
  getAutomatedCleaningUsage,
  getDailyOperationalSummary,
  getInventoryStayScope,
  laundryPieces,
  listLaundryDispatches,
  listLaundryItemPrices,
  listProductConsumptions,
  listProductEntries,
  listUsageCycles,
  registerLaundryDispatch,
  registerProductConsumption,
  registerProductEntry,
  updateProductConsumption,
  updateProductEntry,
  updateUsageCycle,
  updateLaundryDispatch,
  upsertLaundryItemPrices,
};
