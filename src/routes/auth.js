const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticate, requireRole } = require("../../middlewares/authMiddleware");

// login público
router.post("/login", authController.login);

// cadastro protegido
router.post(
  "/register",
  authenticate,
  requireRole(["ADMIN"]),
  authController.register
);

// rota que retorna dados do usuário logado
router.get("/me", authenticate, authController.me);

module.exports = router;
