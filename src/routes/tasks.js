const express = require("express");
const router = express.Router();
const taskController = require("../controllers/taskController");

// rota de checkouts
router.get("/checkouts", taskController.getCheckouts);
router.put("/:id/assign", taskController.assignMaid);
router.get("/monthly", taskController.getMonthly);
router.get("/debug", taskController.getAllTasksDebug);
router.delete("/tasks/:id", taskController.deleteTask);

module.exports = router;
