const { prisma } = require("../prisma.js");
const {
  buildInventoryDashboard,
  createUsageCycle,
  deleteLaundryDispatch,
  deleteProductConsumption,
  deleteProductEntry,
  deleteUsageCycle,
  depleteLotAndCreateCycle,
  getAutomatedCleaningUsage,
  getInventoryStayScope,
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
} = require("../services/inventoryIntelligenceService.js");

function handleError(res, error, fallback = "Erro no modulo de estoque inteligente.") {
  console.error(fallback, error);
  res.status(error.status || 500).json({
    error: error.message || fallback,
  });
}

async function dashboard(req, res) {
  try {
    const payload = await buildInventoryDashboard(req.query);
    res.json(payload);
  } catch (error) {
    handleError(res, error, "Erro ao montar dashboard de estoque inteligente.");
  }
}

async function createEntry(req, res) {
  try {
    const entry = await registerProductEntry(req.body);
    res.status(201).json(entry);
  } catch (error) {
    handleError(res, error, "Erro ao registrar entrada de produto.");
  }
}

async function listEntries(req, res) {
  try {
    const entries = await listProductEntries(req.query);
    res.json(entries);
  } catch (error) {
    handleError(res, error, "Erro ao listar entradas de produto.");
  }
}

async function updateEntry(req, res) {
  try {
    const entry = await updateProductEntry(String(req.params.id), req.body);
    res.json(entry);
  } catch (error) {
    handleError(res, error, "Erro ao atualizar entrada de produto.");
  }
}

async function deleteEntry(req, res) {
  try {
    const result = await deleteProductEntry(String(req.params.id));
    res.json(result);
  } catch (error) {
    handleError(res, error, "Erro ao excluir entrada de produto.");
  }
}

async function createConsumption(req, res) {
  try {
    const consumption = await registerProductConsumption(req.body);
    res.status(201).json(consumption);
  } catch (error) {
    handleError(res, error, "Erro ao registrar consumo operacional.");
  }
}

async function listConsumptions(req, res) {
  try {
    const consumptions = await listProductConsumptions(req.query);
    res.json(consumptions);
  } catch (error) {
    handleError(res, error, "Erro ao listar consumos operacionais.");
  }
}

async function updateConsumption(req, res) {
  try {
    const consumption = await updateProductConsumption(String(req.params.id), req.body);
    res.json(consumption);
  } catch (error) {
    handleError(res, error, "Erro ao atualizar consumo operacional.");
  }
}

async function deleteConsumption(req, res) {
  try {
    const result = await deleteProductConsumption(String(req.params.id));
    res.json(result);
  } catch (error) {
    handleError(res, error, "Erro ao excluir consumo operacional.");
  }
}

async function createLaundry(req, res) {
  try {
    const dispatch = await registerLaundryDispatch(req.body);
    res.status(201).json(dispatch);
  } catch (error) {
    handleError(res, error, "Erro ao registrar envio para lavanderia.");
  }
}

async function listLaundry(req, res) {
  try {
    const dispatches = await listLaundryDispatches(req.query);
    res.json(dispatches);
  } catch (error) {
    handleError(res, error, "Erro ao listar envios para lavanderia.");
  }
}

async function listLaundryPrices(req, res) {
  try {
    const prices = await listLaundryItemPrices();
    res.json(prices);
  } catch (error) {
    handleError(res, error, "Erro ao listar valores da lavanderia.");
  }
}

async function updateLaundryPrices(req, res) {
  try {
    const prices = await upsertLaundryItemPrices(req.body.items || req.body);
    res.json(prices);
  } catch (error) {
    handleError(res, error, "Erro ao salvar valores da lavanderia.");
  }
}

async function updateLaundry(req, res) {
  try {
    const dispatch = await updateLaundryDispatch(String(req.params.id), req.body);
    res.json(dispatch);
  } catch (error) {
    handleError(res, error, "Erro ao atualizar envio para lavanderia.");
  }
}

async function deleteLaundry(req, res) {
  try {
    const result = await deleteLaundryDispatch(String(req.params.id));
    res.json(result);
  } catch (error) {
    handleError(res, error, "Erro ao excluir envio para lavanderia.");
  }
}

async function createCycle(req, res) {
  try {
    const cycle = await createUsageCycle(req.body);
    res.status(201).json(cycle);
  } catch (error) {
    handleError(res, error, "Erro ao calcular ciclo de consumo.");
  }
}

async function listCycles(req, res) {
  try {
    const cycles = await listUsageCycles(req.query);
    res.json(cycles);
  } catch (error) {
    handleError(res, error, "Erro ao listar ciclos de consumo.");
  }
}

async function updateCycle(req, res) {
  try {
    const cycle = await updateUsageCycle(String(req.params.id), req.body);
    res.json(cycle);
  } catch (error) {
    handleError(res, error, "Erro ao atualizar ciclo de consumo.");
  }
}

async function deleteCycle(req, res) {
  try {
    const result = await deleteUsageCycle(String(req.params.id));
    res.json(result);
  } catch (error) {
    handleError(res, error, "Erro ao excluir ciclo de consumo.");
  }
}

async function cleaningUsage(req, res) {
  try {
    const usage = await getAutomatedCleaningUsage(req.query);
    res.json(usage);
  } catch (error) {
    handleError(res, error, "Erro ao contar limpezas automaticas.");
  }
}

async function depleteLot(req, res) {
  try {
    const result = await depleteLotAndCreateCycle(String(req.params.id), req.body);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Erro ao fechar lote e gerar ciclo.");
  }
}

async function listLots(req, res) {
  try {
    const scope = await getInventoryStayScope(req.query.stayId);
    const lots = await prisma.productLot.findMany({
      where: {
        ...scope.stockWhere,
        ...(req.query.productId ? { productId: String(req.query.productId) } : {}),
      },
      include: { product: true, stay: true },
      orderBy: [{ status: "asc" }, { expiresAt: "asc" }, { createdAt: "desc" }],
    });
    res.json(lots);
  } catch (error) {
    handleError(res, error, "Erro ao listar lotes e sobras.");
  }
}

async function updateLot(req, res) {
  try {
    const { remainingQuantity, status, openedAt, depletedAt, expiresAt, notes } = req.body;
    const shouldSetDepletedAt = status === "DEPLETED" && !depletedAt;
    const lot = await prisma.productLot.update({
      where: { id: String(req.params.id) },
      data: {
        ...(remainingQuantity !== undefined ? { remainingQuantity: Number(remainingQuantity) } : {}),
        ...(status ? { status } : {}),
        ...(openedAt ? { openedAt: new Date(openedAt) } : {}),
        ...(depletedAt ? { depletedAt: new Date(depletedAt) } : {}),
        ...(shouldSetDepletedAt ? { depletedAt: new Date() } : {}),
        ...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
      include: { product: true, stay: true },
    });
    res.json(lot);
  } catch (error) {
    handleError(res, error, "Erro ao atualizar lote/sobra.");
  }
}

module.exports = {
  createConsumption,
  createCycle,
  createEntry,
  createLaundry,
  cleaningUsage,
  deleteConsumption,
  deleteCycle,
  deleteEntry,
  deleteLaundry,
  depleteLot,
  dashboard,
  listConsumptions,
  listCycles,
  listEntries,
  listLaundry,
  listLaundryPrices,
  listLots,
  updateConsumption,
  updateCycle,
  updateEntry,
  updateLaundry,
  updateLaundryPrices,
  updateLot,
};
