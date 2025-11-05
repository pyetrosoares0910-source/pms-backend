// src/routes/products.js

const express = require("express");
const {
  listProducts,
  createProduct,
  getProduct,
  updateProduct,
  toggleProduct
} = require("../controllers/productController.js");

const router = express.Router();

router.get("/products", listProducts);
router.post("/products", createProduct);
router.get("/products/:id", getProduct);
router.put("/products/:id", updateProduct);
router.patch("/products/:id/toggle", toggleProduct);

module.exports = router;
