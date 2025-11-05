// src/routes/inventory.js

const express = require("express");
const {
  getInventory,
  createOrUpdateInventory,
  patchInventory,
  createPurchase,
  applyCheckout,
  listPurchases
} = require("../controllers/inventoryController.js");

const router = express.Router();

router.get("/inventory", getInventory);
router.post("/inventory", createOrUpdateInventory);
router.patch("/inventory/:id", patchInventory);
router.get("/purchases", listPurchases);
router.post("/purchases", createPurchase);
router.post("/inventory/apply-checkout", applyCheckout);

module.exports = router;
