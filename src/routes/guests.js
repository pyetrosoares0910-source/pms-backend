const express = require("express");
const router = express.Router();

const guestController = require("../controllers/guestsController");
const { validateGuest, validateGuestUpdate } = require("../../middlewares/validators/guestValidator");
const handleValidation = require("../../middlewares/handleValidation");

router.get("/", guestController.getAllGuests);
router.get("/:id", guestController.getGuestById);

// POST: usa o alias validateGuest (create)
router.post("/", validateGuest, handleValidation, guestController.createGuest);

// PUT: usa o validateGuestUpdate
router.put("/:id", validateGuestUpdate, handleValidation, guestController.updateGuest);

router.delete("/:id", guestController.deleteGuest);

module.exports = router;
