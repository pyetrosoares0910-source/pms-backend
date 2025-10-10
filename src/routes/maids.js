const express = require("express");
const router = express.Router();
const maidController = require("../controllers/maidController");

// Rotas CRUD
router.get("/", maidController.getAll);
router.get("/:id", maidController.getById);
router.post("/", maidController.create);
router.put("/:id", maidController.update);
router.delete("/:id", maidController.remove);

module.exports = router;
