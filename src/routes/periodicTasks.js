const express = require("express");
const controller = require("../controllers/periodicTaskController");

const router = express.Router();

router.get("/", controller.list);
router.post("/", controller.create);
router.get("/executions/history", controller.listExecutions);
router.delete("/bulk", controller.removeMany);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);
router.post("/:id/executions", controller.createExecution);

module.exports = router;
