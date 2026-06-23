const express = require("express");
const router = express.Router();
const assistedCheckinController = require("../controllers/assistedCheckinController");

router.get("/", assistedCheckinController.listAssistedCheckins);
router.get("/:reservationId", assistedCheckinController.getAssistedCheckin);
router.put("/:reservationId", assistedCheckinController.upsertAssistedCheckin);

module.exports = router;
