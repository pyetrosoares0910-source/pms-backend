const express = require("express");
const {
  createConsumption,
  createCycle,
  createEntry,
  createLaundry,
  cleaningUsage,
  depleteLot,
  dashboard,
  listConsumptions,
  listCycles,
  listEntries,
  listLaundry,
  listLots,
  updateLaundry,
  updateCycle,
  updateLot,
} = require("../controllers/inventoryIntelligenceController.js");

const router = express.Router();

router.get("/inventory-intelligence/dashboard", dashboard);
router.get("/inventory-intelligence/cleaning-usage", cleaningUsage);
router.get("/inventory-intelligence/entries", listEntries);
router.post("/inventory-intelligence/entries", createEntry);
router.get("/inventory-intelligence/consumptions", listConsumptions);
router.post("/inventory-intelligence/consumptions", createConsumption);
router.get("/inventory-intelligence/laundry", listLaundry);
router.post("/inventory-intelligence/laundry", createLaundry);
router.put("/inventory-intelligence/laundry/:id", updateLaundry);
router.get("/inventory-intelligence/cycles", listCycles);
router.post("/inventory-intelligence/cycles", createCycle);
router.put("/inventory-intelligence/cycles/:id", updateCycle);
router.get("/inventory-intelligence/lots", listLots);
router.patch("/inventory-intelligence/lots/:id", updateLot);
router.post("/inventory-intelligence/lots/:id/deplete-cycle", depleteLot);

module.exports = router;
