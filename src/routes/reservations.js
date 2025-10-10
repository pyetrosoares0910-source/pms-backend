const express = require("express");
const router = express.Router();
const reservationController = require("../controllers/reservationsController");
const { validateReservationCreate, validateReservationUpdate } = require("../../middlewares/validators/reservationValidator");
const handleValidation = require("../../middlewares/handleValidation");

// Listar
router.get("/", reservationController.getAllReservations);
router.get("/:id", reservationController.getReservationById);

// Criar
router.post("/", validateReservationCreate, handleValidation, reservationController.createReservation);

// Atualizar
router.put("/:id", validateReservationUpdate, handleValidation, reservationController.updateReservation);

// Deletar
router.delete("/:id", reservationController.deleteReservation);

module.exports = router;
