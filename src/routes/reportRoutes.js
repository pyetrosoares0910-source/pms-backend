




// routes/reportRoutes.js
const express = require("express");
const { getMonthlyPerformance, getAnnualPerformance} = require("../controllers/reportController");

const router = express.Router();

router.get("/performance", getMonthlyPerformance);
router.get("/performance/annual", getAnnualPerformance);

module.exports = router;
