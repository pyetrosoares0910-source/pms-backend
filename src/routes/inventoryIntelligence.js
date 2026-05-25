const express = require("express");
const {
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
  updateLaundry,
  updateLaundryPrices,
  updateCycle,
  updateEntry,
  updateLot,
} = require("../controllers/inventoryIntelligenceController.js");

const router = express.Router();

router.get("/inventory-intelligence/dashboard", dashboard);
router.get("/inventory-intelligence/cleaning-usage", cleaningUsage);
router.get("/inventory-intelligence/entries", listEntries);
router.post("/inventory-intelligence/entries", createEntry);
router.put("/inventory-intelligence/entries/:id", updateEntry);
router.delete("/inventory-intelligence/entries/:id", deleteEntry);
router.get("/inventory-intelligence/consumptions", listConsumptions);
router.post("/inventory-intelligence/consumptions", createConsumption);
router.put("/inventory-intelligence/consumptions/:id", updateConsumption);
router.delete("/inventory-intelligence/consumptions/:id", deleteConsumption);
router.get("/inventory-intelligence/laundry", listLaundry);
router.post("/inventory-intelligence/laundry", createLaundry);
router.put("/inventory-intelligence/laundry/:id", updateLaundry);
router.delete("/inventory-intelligence/laundry/:id", deleteLaundry);
router.get("/inventory-intelligence/laundry-prices", listLaundryPrices);
router.put("/inventory-intelligence/laundry-prices", updateLaundryPrices);
router.get("/inventory-intelligence/cycles", listCycles);
router.post("/inventory-intelligence/cycles", createCycle);
router.put("/inventory-intelligence/cycles/:id", updateCycle);
router.delete("/inventory-intelligence/cycles/:id", deleteCycle);
router.get("/inventory-intelligence/lots", listLots);
router.patch("/inventory-intelligence/lots/:id", updateLot);
router.post("/inventory-intelligence/lots/:id/deplete-cycle", depleteLot);

module.exports = router;
