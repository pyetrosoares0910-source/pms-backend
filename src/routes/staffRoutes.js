const express = require("express");
const router = express.Router();

const staffController = require("../controllers/staffController");
const { validateStaff } = require("../../middlewares/validators/staffValidator");
const handleValidation = require("../../middlewares/handleValidation");

router.get("/", staffController.getAllStaff);
router.get("/:id", staffController.getStaffById);
router.post("/", validateStaff, handleValidation, staffController.createStaff);
router.put("/:id", validateStaff, handleValidation, staffController.updateStaff);
router.delete("/:id", staffController.deleteStaff);

module.exports = router;
