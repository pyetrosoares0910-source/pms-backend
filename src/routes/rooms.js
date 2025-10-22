const express = require("express");
const router = express.Router();

const roomController = require("../controllers/roomController");
const { validateRoom } = require("../../middlewares/validators/roomValidator");
const handleValidation = require("../../middlewares/handleValidation");

router.get("/", roomController.getAllRooms);
router.get("/:id", roomController.getRoomById);
router.post("/", validateRoom, handleValidation, roomController.createRoom);
router.put("/:id", validateRoom, handleValidation, roomController.updateRoom);
router.delete("/:id", roomController.deleteRoom);
router.post("/rooms/:id/upload", roomController.uploadRoomImage);

module.exports = router;
