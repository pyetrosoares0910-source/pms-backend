const express = require("express");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const app = express();
const prisma = new PrismaClient();

const allowedOrigins = [
  "http://localhost:5173",
  /\.vercel\.app$/, // 👈 aceita QUALQUER domínio *.vercel.app
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Se for localhost ou qualquer domínio da Vercel, libera
  if (
    allowedOrigins.some((allowed) =>
      typeof allowed === "string" ? allowed === origin : allowed.test(origin)
    )
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});


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
const paymentRoutes = require("./routes/paymentRoutes");

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
app.use("/payments", paymentRoutes);

// 🔹 Teste
app.get("/", (req, res) => {
  res.send("Servidor rodando! 🔥");
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;
