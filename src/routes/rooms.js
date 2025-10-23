const express = require("express");
const router = express.Router();

const roomController = require("../controllers/roomController");
const { validateRoom } = require("../../middlewares/validators/roomValidator");
const handleValidation = require("../../middlewares/handleValidation");

// UPLOAD
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });


router.get("/", roomController.getAllRooms);
router.get("/:id", roomController.getRoomById);
router.post("/", validateRoom, handleValidation, roomController.createRoom);
router.put("/:id", validateRoom, handleValidation, roomController.updateRoom);
router.delete("/:id", roomController.deleteRoom);
router.post("/:id/upload", roomController.uploadMiddleware, roomController.uploadRoomImage);

module.exports = router;
