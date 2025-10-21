import React, { useEffect, useRef, useState } from "react";
import api from "../api/axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { motion } from "framer-motion";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import autoTable from "jspdf-autotable";

const STAY_ORDER = [
  "Internacional Stay (Urussuí)",
  "Iguatemi Stay A (Butantã)",
  "Iguatemi Stay B (Butantã)",
  "Itaim Stay (Tabapuã)",
  "Itaim Stay 2 (Tabapuã)",
  "JK Stay (Clodomiro)",
  "Estanconfor Vila Olímpia",
];

const orderIndex = STAY_ORDER.reduce((acc, n, i) => ((acc[n] = i), acc), {});

export default function PerformanceReport() {
  const [monthlyData, setMonthlyData] = useState(null);
  const [annualData, setAnnualData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month() + 1);
  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const reportRef = useRef(null);

  // fonte Inter
  useEffect(() => {
    const id = "inter-font-link";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
  const fetchData = async () => {
    try {
      const [monthlyRes, annualRes] = await Promise.all([
        api.get(`/reports/performance?month=${selectedMonth}&year=${selectedYear}`),
        api.get(`/reports/performance/annual?year=${selectedYear}`),
      ]);

      const normalize = (s) =>
        s?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

      const sortStays = (data) =>
        [...(data ?? [])].sort((a, b) => {
          const ai = STAY_ORDER.findIndex(
            (key) => normalize(key) === normalize(a.stayName)
          );
          const bi = STAY_ORDER.findIndex(
            (key) => normalize(key) === normalize(b.stayName)
          );
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });

      setMonthlyData({
        month: monthlyRes.data.month,
        year: monthlyRes.data.year,
        stays: sortStays(monthlyRes.data.stays),
      });

      setAnnualData({
        year: annualRes.data.year,
        stays: sortStays(annualRes.data.stays),
      });

      console.log("📊 monthlyData preview:", monthlyRes.data.stays?.[0]);
      console.log("📈 annualData preview:", annualRes.data.stays?.[0]);

      
      setLoading(false);
    } catch (err) {
      console.error("❌ Erro ao carregar relatórios:", err);
      setLoading(false);
    }
  };

  fetchData();
}, [selectedMonth, selectedYear]);



  /* ========== Helpers ========== */
  const getColorByOccupancy = (value) => {
    const v = Number.parseFloat(value);
    if (v >= 60) return "text-green-600 font-semibold";
    if (v >= 40) return "text-yellow-600 font-semibold";
    return "text-red-600 font-semibold";
  };

  const roomDisplayName = (r, idx) =>
    r?.title || r?.name || r?.roomNumber || r?.code || `Unidade ${idx + 1}`;

  const centerifyData = (data) => {
    if (!data || data.length >= 3) return data;
    const blank = { name: " ", ocupado: 0, vazio: 0, _blank: true };
    if (data.length === 1) return [blank, data[0], blank];
    if (data.length === 2) return [blank, ...data, blank];
    return data;
  };

  const buildMonthlyChartData = (stay) => {
  const arr = (stay.rooms || []).map((r, idx) => {
    const occ = parseFloat(r.ocupacao ?? 0);
    const ocupado = isNaN(occ) ? 0 : occ;
    const vazio = Math.max(0, 100 - ocupado);
    return {
      name: roomDisplayName(r, idx),
      ocupado: Number(ocupado), // 👈 garante número
      vazio: Number(vazio),     // 👈 garante número
    };
  });
  return centerifyData(arr);
};


  /* ========== PDF cabeçalho e rodapé ========== */
  const periodLabel = `${dayjs()
    .month(selectedMonth - 1)
    .format("MMMM")
    .toUpperCase()} / ${selectedYear}`;
  const generatedAt = dayjs().format("DD/MM/YYYY HH:mm");
  const totalPagesExp = "{total_pages_count_string}";

  const drawHeader = (pdf, pageWidth, margin) => {
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(40, 53, 147);
    pdf.setFontSize(14);
    pdf.text("Vz", margin.left, 12);

    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(17, 24, 39);
    pdf.setFontSize(12);
    pdf.text(" — Relatório de Desempenho", margin.left + 8, 12);

    pdf.setFontSize(10);
    pdf.setTextColor(107, 114, 128);
    pdf.text(`${periodLabel} · Gerado em ${generatedAt}`, margin.left, 18);

    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.2);
    pdf.line(margin.left, 20, pageWidth - margin.right, 20);
  };

  const drawFooter = (pdf, pageWidth, pageHeight, margin, pageNumber) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(107, 114, 128);
    const label = `Página ${pageNumber} de ${totalPagesExp}`;
    pdf.text(label, pageWidth - margin.right, pageHeight - 6, {
      align: "right",
    });
  };

  const addCanvasPaginated = (pdf, canvas, pageWidth, pageHeight, margin, startNew = false) => {
    const contentWidth = pageWidth - margin.left - margin.right;
    const contentHeight = pageHeight - margin.top - margin.bottom;
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/png");

    if (startNew && pdf.getNumberOfPages() > 0) pdf.addPage();
    if (pdf.getNumberOfPages() === 0) pdf.addPage();

    let position = margin.top;
    let heightLeft = imgHeight;

    drawHeader(pdf, pageWidth, margin);
    pdf.addImage(imgData, "PNG", margin.left, position, imgWidth, imgHeight);
    heightLeft -= contentHeight;

    while (heightLeft > 0) {
      pdf.addPage();
      drawHeader(pdf, pageWidth, margin);
      const positionY = margin.top + (heightLeft - imgHeight);
      pdf.addImage(imgData, "PNG", margin.left, positionY, imgWidth, imgHeight);
      heightLeft -= contentHeight;
    }
  };
const printReport = () => {
  if (!reportRef.current) return;

  const html = reportRef.current.outerHTML;

  // coleta os mesmos CSS carregados na página (Tailwind/DaisyUI)
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((l) => `<link rel="stylesheet" href="${l.href}">`)
    .join("");

  const inlineStyles = Array.from(document.querySelectorAll('style'))
    .map((s) => `<style>${s.innerHTML}</style>`)
    .join("");

  const w = window.open("", "_blank", "width=1200,height=900");
  w.document.open();
  w.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Relatório de Desempenho</title>
${styles}
${inlineStyles}
<style>
  /* Força orientação horizontal */
  @page {
    size: A4 landscape;
    margin: 12mm;
  }

  html, body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    background: white;
    
  }

  /* Evita quebras feias e oculta botões */
  .no-print { display: none !important; }
  section, .card, [data-chunk] { page-break-inside: avoid; }
  [data-chunk="monthly"] { page-break-before: always; }
</style>

</head>
<body>
${html}
</body>
</html>`);
  w.document.close();

  // time load CSS 
  setTimeout(() => {
    w.focus();
    w.print();
    w.close();
  }, 600);
};

  /* ========== Geração PDF ========== */
  

    const patchHtml2CanvasForOKLCH = () => {
  if (!window.html2canvas || window.__patched_oklch_fix__) return;
  window.__patched_oklch_fix__ = true;

  const origParseColor = window.html2canvas.utils?.parseColor;
  if (!origParseColor) return;

  // ✅ intercepta apenas durante a captura
  window.html2canvas.utils.parseColor = function (value) {
    try {
      if (typeof value === "string" && value.includes("oklch")) {
        // substitui qualquer cor OKLCH por um cinza claro seguro
        return { r: 245, g: 245, b: 245, a: 1 };
      }
      return origParseColor.call(this, value);
    } catch {
      return { r: 245, g: 245, b: 245, a: 1 };
    }
  };
};

const generatePDF = async () => {
  try {
    // ✅ Patch temporário para OKLCH
    if (window.html2canvas && !window.__patched_oklch_fix__) {
      const origParseColor = window.html2canvas.utils?.parseColor;
      window.__patched_oklch_fix__ = true;
      if (origParseColor) {
        window.html2canvas.utils.parseColor = function (value) {
          try {
            if (typeof value === "string" && value.includes("oklch")) {
              return { r: 255, g: 255, b: 255, a: 1 };
            }
            return origParseColor.call(this, value);
          } catch {
            return { r: 255, g: 255, b: 255, a: 1 };
          }
        };
      }
    }

    if (!reportRef.current) return;
    setGenerating(true);

    const PX_TO_MM = 0.264583;
    const toMM = (px) => px * PX_TO_MM;

    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = { top: 42, left: 15, right: 15, bottom: 20 };

    const loadLogo = (src) =>
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });
    const logoImg = await loadLogo("/logo_vz.png");

    const periodLabel = `${dayjs()
      .month(selectedMonth - 1)
      .format("MMMM")
      .toUpperCase()} / ${selectedYear}`;
    const generatedAt = dayjs().format("DD/MM/YYYY HH:mm");

    const drawHeader = (titleLine = null) => {
      if (logoImg) {
        const h = 14;
        const ratio = logoImg.naturalWidth / logoImg.naturalHeight || 1;
        pdf.addImage(logoImg, "PNG", margin.left, 12, h * ratio, h);
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.setTextColor(25, 46, 91);
      pdf.text("Relatório de Desempenho", margin.left + 25, 18);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(100);
      pdf.text(`${periodLabel} · Gerado em ${generatedAt}`, margin.left + 25, 24);

      pdf.setDrawColor(230);
      pdf.setLineWidth(0.3);
      pdf.line(margin.left, 30, pageWidth - margin.right, 30);

      if (titleLine) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.setTextColor(25, 46, 91);
        pdf.text(titleLine, margin.left, margin.top - 2);
      }
    };

    const drawFooter = (n) => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(140);
      pdf.text(`Página ${n}`, pageWidth - margin.right, pageHeight - 8, {
        align: "right",
      });
    };

    const captureElement = async (el) => {
  if (!el) throw new Error("Elemento nulo ao capturar.");

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-9999px";
  wrapper.style.top = "0";
  wrapper.style.width = "1100px";
  wrapper.style.background = "#fff";
  document.body.appendChild(wrapper);
  const clone = el.cloneNode(true);
  wrapper.appendChild(clone);

  // 🔹 Amplia apenas tabelas, sem mexer no layout global
  clone.querySelectorAll("table").forEach((tbl) => {
    tbl.style.transform = "scale(1.3)";
    tbl.style.transformOrigin = "top left";
    tbl.style.width = "calc(100% / 1.3)"; // corrige o overflow após o scale

    // Ajusta fonte e padding visualmente
    tbl.querySelectorAll("td, th").forEach((c) => {
      c.style.fontSize = "20px";
      c.style.lineHeight = "1.8";
      c.style.padding = "12px 10px";
    });
  });

  // 🔹 Neutraliza cores OKLCH
  clone.querySelectorAll("*").forEach((node) => {
    const style = window.getComputedStyle(node);
    for (const prop of ["color", "backgroundColor", "borderColor"]) {
      const val = style.getPropertyValue(prop);
      if (val && val.includes("oklch")) {
        node.style.setProperty(
          prop,
          prop === "backgroundColor" ? "#ffffff" : "#111827",
          "important"
        );
      }
    }
  });

  // 🔹 Limpa SVGs
  wrapper.querySelectorAll("svg").forEach((svg) => {
    svg.querySelectorAll("*").forEach((el) => {
      for (const attr of el.getAttributeNames ? el.getAttributeNames() : []) {
        const val = el.getAttribute(attr);
        if (typeof val === "string" && val.includes("oklch")) {
          el.setAttribute(attr, "#ffffff");
        }
      }
    });
  });

  // 🔹 Bloqueia fillStyle OKLCH em canvas
  const originalCreateElement = document.createElement;
  document.createElement = function (tagName, options) {
    const element = originalCreateElement.call(this, tagName, options);
    if (tagName?.toLowerCase() === "canvas") {
      const ctx = element.getContext("2d");
      if (ctx) {
        const desc = Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(ctx),
          "fillStyle"
        );
        if (desc) {
          Object.defineProperty(ctx, "fillStyle", {
            set(value) {
              if (typeof value === "string" && value.includes("oklch"))
                value = "#ffffff";
              desc.set.call(this, value);
            },
            get() {
              return desc.get.call(this);
            },
            configurable: true,
          });
        }
      }
    }
    return element;
  };

  let canvas;
  try {
    canvas = await html2canvas(wrapper, {
      scale: 1.4,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
  } finally {
    document.createElement = originalCreateElement;
    document.body.removeChild(wrapper);
  }

  return canvas;
};


    const normalize = (s) =>
      s?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const findBlock = (t, name) =>
      Array.from(document.querySelectorAll(`[data-chunk="${t}"]`)).find(
        (b) => normalize(b.querySelector("h3")?.textContent) === normalize(name)
      );

    const addImageCentered = (canvas, y, wMax) => {
      const wMM = toMM(canvas.width);
      const hMM = toMM(canvas.height);
      const w = Math.min(wMax, wMM);
      const h = (w * hMM) / wMM;
      const dx = margin.left + (wMax - w) / 2;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", dx, y, w, h);
      return h;
    };

    let page = 1;
    let first = true;
    const newPage = (title) => {
  if (!first) {
    pdf.addPage();
    page++;
  }
  drawHeader(title);
  first = false;
};


const drawOccupancyCards = (pdf, stay, startY, usableW) => {
  const rooms = stay.rooms || [];
  const cardsPerRow = 5; 
  const cardWidth = (usableW - (cardsPerRow - 1) * 6) / cardsPerRow;
  const cardHeight = 22;
  const gap = 6;
  const marginLeft = margin.left;
  const marginTop = startY;

  pdf.setFont("helvetica", "bold");

  rooms.forEach((room, idx) => {
    const row = Math.floor(idx / cardsPerRow);
    const col = idx % cardsPerRow;

    const x = marginLeft + col * (cardWidth + gap);
    const y = marginTop + row * (cardHeight + gap);

    const occ = Number(room.ocupacao) || 0;

    // Define cor de fundo de acordo com ocupação
    let fillColor = [108, 141, 180]; // azul 
    if (occ >= 50) fillColor = [108, 141, 180];     
    else fillColor = [239, 68, 68];                // vermelho

    // Card base arredondado
    pdf.setFillColor(...fillColor);
    pdf.setDrawColor(...fillColor);
    pdf.roundedRect(x, y, cardWidth, cardHeight, 3, 3, "F");

    // Nome da unidade
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8.5);
    pdf.text(room.name || room.title || `Unidade ${idx + 1}`, x + cardWidth / 2, y + 9, {
      align: "center",
    });

    // Ocupação
    pdf.setFontSize(14);
    pdf.text(`${occ}%`, x + cardWidth / 2, y + cardHeight / 1.45, {
      align: "center",
    });
  });

  const totalRows = Math.ceil(rooms.length / cardsPerRow);
  return totalRows * (cardHeight + gap);
};

// ===== Mensal =====
for (const stay of monthlyData.stays) {
  try {
    const block = findBlock("monthly", stay.stayName);
    if (!block) continue;

    const chartEl = block.querySelector(".recharts-wrapper");
    if (!chartEl) continue;

    newPage(stay.stayName);

    // Subtítulo ajustado
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(25, 46, 91);
    pdf.text("Relatório Mensal — Ocupação por Unidade", margin.left, margin.top + 6);

    const usableW = pageWidth - margin.left - margin.right;
    const chartCanvas = await captureElement(chartEl);
    const chartHeight = addImageCentered(chartCanvas, margin.top + 8, usableW * 1.25);

    // 🟦 Cards de ocupação (substitui tabela)
    const cardsY = margin.top + chartHeight + 9;
    const cardsHeight = drawOccupancyCards(pdf, stay, cardsY, usableW);

    // 🟨 Mini tabela de resumo no rodapé
    const resumoY = pageHeight - margin.bottom - 60;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    pdf.setTextColor(25, 46, 91);
    pdf.text(`Resumo — ${stay.stayName}`, margin.left, resumoY - 10);

    // Linha divisória sutil
    pdf.setDrawColor(220);
    pdf.setLineWidth(0.2);
    pdf.line(margin.left, resumoY - 4, margin.left + usableW * 0.7, resumoY - 4);

    // Indicadores calculados
    const totalDiarias = stay.totalDiarias ?? 0;
    const totalReservas = stay.totalReservas ?? 0;
    const ocupacaoMedia = stay.ocupacaoMedia ?? 0;

    const mediaDiariasReserva =
      totalReservas > 0 ? (totalDiarias / totalReservas).toFixed(1) : "-";

    const unidadeMaisOcupada = stay.rooms?.length
      ? (() => {
          const top = stay.rooms.reduce((a, b) =>
            (a.ocupacao ?? 0) > (b.ocupacao ?? 0) ? a : b
          );
          return `${top.name || top.title || "—"} (${top.ocupacao ?? 0}%)`;
        })()
      : "-";

    const unidadeMenosOcupada = stay.rooms?.length
      ? (() => {
          const low = stay.rooms.reduce((a, b) =>
            (a.ocupacao ?? 0) < (b.ocupacao ?? 0) ? a : b
          );
          return `${low.name || low.title || "—"} (${low.ocupacao ?? 0}%)`;
        })()
      : "-";

    const diasNoMes = dayjs(`${selectedYear}-${selectedMonth}-01`).daysInMonth();
    const capacidadeTotal = (stay.rooms?.length ?? 0) * diasNoMes;
    const eficiencia =
      capacidadeTotal > 0 ? ((totalDiarias / capacidadeTotal) * 100).toFixed(1) : "-";

    autoTable(pdf, {
      startY: resumoY,
      theme: "plain", // estilo limpo
      body: [
        ["Total de diárias", totalDiarias],
        ["Total de reservas", totalReservas],
        ["Ocupação média (%)", `${ocupacaoMedia}%`],
        ["Média de diárias por reserva", mediaDiariasReserva],
        ["Unidade mais ocupada", unidadeMaisOcupada],
        ["Unidade menos ocupada", unidadeMenosOcupada],
        ["Taxa de eficiência (reservas × capacidade)", `${eficiencia}%`],
      ],
      styles: {
        fontSize: 9.5,
        cellPadding: 1.4,
        lineColor: [220, 220, 220],
        lineWidth: 0.2,
        textColor: [33, 33, 33],
      },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      margin: { left: margin.left, right: margin.right },
      tableWidth: usableW * 0.7,
      columnStyles: {
        0: { halign: "left", cellWidth: usableW * 0.45 },
        1: { halign: "right" },
      },
    });

    drawFooter(page);
  } catch (e) {
    console.warn("⚠️ Falha ao gerar página de", stay.stayName, e);
  }
}


    // ===== Anual =====
    newPage("Desempenho Anual");
    let y = margin.top + 2;
    const usableW = pageWidth - margin.left - margin.right;
    const slotH = 65;

    for (const stay of annualData.stays) {
      try {
        const block = findBlock("annual", stay.stayName);
        if (!block) continue;
        const chartEl = block.querySelector(".recharts-wrapper");
        if (!chartEl) continue;

        const chartCanvas = await captureElement(chartEl);
        if (y + slotH > pageHeight - margin.bottom) {
          newPage("Desempenho Anual");
          y = margin.top + 2;
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(25, 46, 91);
        pdf.text(stay.stayName, margin.left, y);
        y += 4;

        const wMM = toMM(chartCanvas.width);
        const hMM = toMM(chartCanvas.height);
        const w = Math.min(usableW, wMM);
        const h = Math.min(slotH, (w * hMM) / wMM);
        const dx = margin.left + (usableW - w) / 2;
        pdf.addImage(chartCanvas.toDataURL("image/png"), "PNG", dx, y, w, h);
        y += h + 4;
        drawFooter(page);
      } catch (e) {
        console.warn("⚠️ Falha anual:", stay.stayName, e);
      }
    }

    pdf.save(
      `Relatorio_Desempenho_${selectedYear}-${String(selectedMonth).padStart(2, "0")}.pdf`
    );
  } catch (err) {
    console.error("❌ Erro ao gerar PDF:", err);
    alert("Falha ao gerar PDF. Veja o console para detalhes.");
  } finally {
    setGenerating(false);
  }
};


  /* ========== Render ========== */
  return (
    console.log("🧭 Base API:", import.meta.env.VITE_API_URL),

    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="p-8 space-y-10 bg-gray-50 min-h-screen"
      ref={reportRef}
      style={{
        fontFamily:
          "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-800">
            Relatório de Desempenho
          </h1>
          <p className="text-sm text-gray-500 mt-1 uppercase tracking-wide">
            {dayjs().month(selectedMonth - 1).format("MMMM").toUpperCase()} /{" "}
            {selectedYear}
          </p>
        </div>

        <div className="flex gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-white border border-gray-300 text-gray-800 px-4 py-2 rounded-md shadow-sm"
            disabled={generating}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {dayjs().month(m - 1).format("MMMM")}
              </option>
            ))}
          </select>

          <input
            type="number"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-white border border-gray-300 text-gray-800 px-4 py-2 rounded-md w-24 text-center shadow-sm"
            disabled={generating}
          />
          <button
  onClick={printReport}
             className="bg-sky-700 hover:bg-sky-800 text-white px-4 py-2 rounded-md shadow-sm">  
             Imprimir / Salvar PDF
              </button>
            <button
  onClick={() => {
    const url = `${import.meta.env.VITE_API_URL}/reports/performance/pdf?month=${selectedMonth}&year=${selectedYear}`;
  window.open(url, "_blank");
  }}
  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md shadow-sm"
>
  Gerar PDF (Servidor)
</button>


          <button
            onClick={generatePDF}
            className={`${
              generating
                ? "bg-indigo-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            } text-white px-4 py-2 rounded-md shadow-sm`}
            disabled={generating}
          >
            {generating ? "Gerando..." : "Gerar PDF"}
          </button>
        </div>
      </div>

      {/* Relatório Mensal */}
      <section>
        <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b border-gray-300 pb-1">
          Relatório Mensal — Ocupação por Unidade
        </h2>

        <div className="flex flex-col space-y-8">
          {Array.isArray(monthlyData?.stays) &&
  monthlyData.stays
    .sort((a, b) => {
      const ordem = [
        "Itaim Stay (Tabapuã)",
        "JK Stay (Clodomiro)",
        "Itaim Stay 2 (tabapuã)",
        "Internacional Stay (Urussuí)",
        "Iguatemi Stay A (Butantã)",
        "Iguatemi Stay B (Butantã)",
        "Estanconfor Vila Olímpia",
      ];
      return ordem.indexOf(a.stayName) - ordem.indexOf(b.stayName);
    })
    .map((stay) => (
      
            <motion.div
              key={stay.stayName}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white rounded-xl p-6 border border-gray-200"
              data-chunk="monthly"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-semibold text-gray-800">
                  {stay.stayName}
                </h3>
                <p className="text-sm text-gray-600">
                  Ocupação média:{" "}
                  <span className="text-indigo-600 font-medium">
                    {stay.ocupacaoMedia}%
                  </span>{" "}
                  | Reservas:{" "}
                  <span className="text-gray-700 font-medium">
                    {stay.totalReservas}
                  </span>
                </p>
              </div>

              {/* Container tabela + gráfico com alinhamento vertical */}
<div className="flex flex-row gap-6 items-stretch">
  {/* Tabela */}
  <div className="basis-[40%]">
    <div className="overflow-x-auto">
      <table className="min-w-full border text-sm">
        <thead className="bg-gray-100 text-gray-700">
          <tr>
            <th className="border px-3 py-2 text-left">Unidade</th>
            <th className="border px-3 py-2 text-center">Ocupado</th>
            <th className="border px-3 py-2 text-center">Vazio</th>
            <th className="border px-3 py-2 text-center">Reservas</th>
            <th className="border px-3 py-2 text-center">Ocupação (%)</th>
          </tr>
        </thead>
        <tbody>
          {stay.rooms.map((r, idx) => (
            <tr key={r.id || `${stay.stayName}-${idx}`}>
              <td className="border px-3 py-2">{roomDisplayName(r, idx)}</td>
              <td className="border px-3 py-2 text-center">{r.ocupado}</td>
              <td className="border px-3 py-2 text-center">{r.vazio}</td>
              <td className="border px-3 py-2 text-center">{r.reservas ?? 0}</td>
              <td
                className={`border px-3 py-2 text-center ${getColorByOccupancy(
                  r.ocupacao
                )}`}
              >
                {Number.isFinite(Number(r.ocupacao))
                  ? `${r.ocupacao}%`
                  : `${r.ocupacao}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 flex justify-between items-center text-sm">
        <span className="font-medium text-gray-700">
          Total diárias: {stay.totalDiarias}
        </span>
        <span className="font-medium text-gray-700">
          Ocupação média: {stay.ocupacaoMedia}%
        </span>
      </div>
    </div>
  </div>

  {/* Gráfico centralizado verticalmente */}
  <div className="basis-[60%] flex justify-center self-center">
    <div className="h-[320px] w-full flex items-center justify-center bg-white">
      <ResponsiveContainer width="100%" height="150%">
        <BarChart
  data={buildMonthlyChartData(stay)}
  margin={{
    top: 80,
    right: 30,
    left: 15,
    bottom: 60,
  }}
  barCategoryGap="20%" 
  barGap={5}
  barSize={(stay.rooms?.length ?? 0) <= 2 ? 90 : undefined} 
>

          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            stroke="#6b7280"
            tick={{ fontSize: 12 }}
            angle={
              stay.stayName.includes("Internacional Stay") ? 0 :
              (stay.rooms?.length ?? 0) > 8 ? -30 : 0
            }
            textAnchor={
              stay.stayName.includes("Internacional Stay") ? "middle" :
              (stay.rooms?.length ?? 0) > 8 ? "end" : "middle"
            }
            interval={0}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(t) => `${t}%`}
            stroke="#6b7280"
          />
          <Tooltip
            formatter={(v) => `${Math.round(v)}%`}
            contentStyle={{
              backgroundColor: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              color: "#111827",
            }}
          />
          <Legend
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{
              position: "absolute",
              bottom: 65,
              textAlign: "center",
              width: "100%",
            }}
          />
          <Bar dataKey="ocupado" fill="#3b82f6" name="Ocupado (%)" fillOpacity={1} />
<Bar dataKey="vazio" fill="#ef4444" name="Vazio (%)" fillOpacity={1} />

        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>



              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Relatório Anual */}
      <section>
        <h2 className="text-xl font-semibold text-gray-700 mb-4 border-b border-gray-300 pb-1">
          Desempenho Anual
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">


          {Array.isArray(annualData?.stays) &&
  annualData.stays.map((stay) => (

            <motion.div
              key={stay.stayName}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white rounded-xl p-6 border border-gray-200"
              data-chunk="annual"
            >
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                {stay.stayName}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Ocupação média anual:{" "}
                <span className="text-indigo-600 font-medium">
                  {stay.ocupacaoMediaAnual}%
                </span>
              </p>

              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stay.meses}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="mes"
                      tickFormatter={(m) =>
                        dayjs().month(m - 1).format("MMM")
                      }
                      stroke="#6b7280"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(t) => `${t}%`}
                      stroke="#6b7280"
                    />
                    <Tooltip
                      formatter={(v) => `${v}%`}
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        color: "#111827",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="ocupacao"
                      stroke="#6366f1"
                      strokeWidth={2}
                      name="Ocupação (%)"
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </motion.div>
  );
}
