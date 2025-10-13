const express = require("express");
const puppeteer = require("puppeteer");

const router = express.Router();

router.get("/reports/performance/pdf", async (req, res) => {
  const { month, year } = req.query;

  // 🔹 URL do front: abre diretamente a página do relatório de desempenho
  const FRONTEND_URL = process.env.FRONTEND_URL || "https://pms-backend-mauve.vercel.app"; //http://localhost:5173

router.get("/reports/performance/pdf", async (req, res) => {
  const { month, year } = req.query;
  const frontUrl = `${FRONTEND_URL}/reports/performance?month=${month}&year=${year}`;

  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.goto(frontUrl, { waitUntil: "networkidle0", timeout: 60000 });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Relatorio_${year}-${month}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("❌ Erro ao gerar PDF via Puppeteer:", err);
    return res.status(500).json({ error: "Falha ao gerar PDF via Puppeteer." });
  }
});

});

module.exports = router;
