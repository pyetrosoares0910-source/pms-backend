const express = require("express");
const { getPaymentStatuses, upsertPaymentStatus } = require("../controllers/paymentStatusController");

const router = express.Router();

router.get("/status", getPaymentStatuses);
router.post("/status", upsertPaymentStatus);

module.exports = router;
