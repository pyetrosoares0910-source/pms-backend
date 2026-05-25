const express = require("express");
const {
  createConsumption,
  createEntry,
  createLaundry,
  dashboard,
  listConsumptions,
  listEntries,
  listLaundry,
  listLots,
  updateLaundry,
  updateLot,
} = require("../controllers/inventoryIntelligenceController.js");

const router = express.Router();

router.get("/inventory-intelligence/dashboard", dashboard);
router.get("/inventory-intelligence/entries", listEntries);
router.post("/inventory-intelligence/entries", createEntry);
router.get("/inventory-intelligence/consumptions", listConsumptions);
router.post("/inventory-intelligence/consumptions", createConsumption);
router.get("/inventory-intelligence/laundry", listLaundry);
router.post("/inventory-intelligence/laundry", createLaundry);
router.put("/inventory-intelligence/laundry/:id", updateLaundry);
router.get("/inventory-intelligence/lots", listLots);
router.patch("/inventory-intelligence/lots/:id", updateLot);

module.exports = router;
