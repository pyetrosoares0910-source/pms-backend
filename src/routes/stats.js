const express = require("express");
const router = express.Router();
const controller = require("../controllers/statsController");

router.get("/overview", controller.overviewStats);
router.get("/ranking", controller.mostUsedRooms);
router.get("/cancelamentos", controller.cancelRate);
router.get("/ocupacao", controller.occupancyRate); // 👈 Adicionada aqui

module.exports = router;
