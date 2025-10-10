const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const app = express();
const prisma = new PrismaClient();

// ✅ Configuração CORS ajustada
const allowedOrigins = [
  "http://localhost:5173",                   // ambiente local
  "https://pms-backend-mauve.vercel.app/",                  // domínio final
  "https://pms-frontend.vercel.app"          // fallback da Vercel
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite requests sem origin (como Postman/Insomnia)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());

// 🔹 Rotas
const authRoutes = require("./routes/auth");
const guestsRoutes = require("./routes/guests");
const staffRoutes = require("./routes/staffRoutes");
const roomsRoutes = require("./routes/rooms");
const reservationsRoutes = require("./routes/reservations");
const statsRoutes = require("./routes/stats");
const { authRequired, onlyRoles } = require("../middlewares/authMiddleware");
const cleaningStaffRoutes = require("./routes/cleaningStaff");
const maintenanceRoutes = require("./routes/maintenance");
const staysRoutes = require("./routes/stays");
const taskRoutes = require("./routes/tasks");
const maidRoutes = require("./routes/maids");
const reportPdfRoutes = require("./routes/reportPdfRoutes");

app.use("/auth", authRoutes);
app.use("/guests", guestsRoutes);
app.use("/staff", staffRoutes);
app.use("/rooms", roomsRoutes);
app.use("/reservations", reservationsRoutes);
app.use("/stats", statsRoutes);
app.use("/cleaning-staff", cleaningStaffRoutes);
app.use("/maintenance", maintenanceRoutes);
app.use("/stays", staysRoutes);
app.use("/tasks", taskRoutes);
app.use("/maids", maidRoutes);
app.use("/reports", require("./routes/reportRoutes"));
app.use("/", reportPdfRoutes);

// 🔹 Teste
app.get("/", (req, res) => {
  res.send("Servidor rodando! 🔥");
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;
