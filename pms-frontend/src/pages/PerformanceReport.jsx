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

// (opcional) marca que já tentamos patchear; não vamos depender só disso
const ensureOklchPatch = () => {
  if (!html2canvas || html2canvas.__oklchPatched) return;
  html2canvas.__oklchPatched = true;

  const utils = html2canvas.utils;
  const origParseColor = utils?.parseColor;
  if (!origParseColor) return;

  utils.parseColor = function (value) {
    try {
      if (typeof value === "string" && value.includes("oklch")) {
        return { r: 255, g: 255, b: 255, a: 1 };
      }
      return origParseColor.call(this, value);
    } catch {
      return { r: 255, g: 255, b: 255, a: 1 };
    }
  };
};

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
          api.get(
            `/reports/performance?month=${selectedMonth}&year=${selectedYear}`
          ),
          api.get(`/reports/performance/annual?year=${selectedYear}`),
        ]);

        const normalize = (s) =>
          s
            ?.toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();

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
    if (v >= 60) return "text-green-600 dark:text-emerald-400 font-semibold";
    if (v >= 40) return "text-yellow-600 dark:text-amber-300 font-semibold";
    return "text-red-600 dark:text-rose-400 font-semibold";
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
        ocupado: Number(ocupado),
        vazio: Number(vazio),
      };
    });
    return centerifyData(arr);
  };

  /* ========== Imprimir / Salvar PDF (browser) ========== */

  const printReport = () => {
    if (!reportRef.current) return;

    const html = reportRef.current.outerHTML;

    const styles = Array.from(
      document.querySelectorAll('link[rel="stylesheet"]')
    )
      .map((l) => `<link rel="stylesheet" href="${l.href}">`)
      .join("");

    const inlineStyles = Array.from(document.querySelectorAll("style"))
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
  @page {
    size: A4 landscape;
    margin: 12mm;
  }

  html, body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    background: white;
  }

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

    setTimeout(() => {
      w.focus();
      w.print();
      w.close();
    }, 600);
  };

  /* ========== Captura segura (html2canvas + limpeza de OKLCH) ========== */

  const captureElement = async (el) => {
    if (!el) throw new Error("Elemento nulo ao capturar.");

    // garante patch extra (não é a única linha de defesa)
    ensureOklchPatch();

    const marker = `capture-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;
    el.setAttribute("data-html2canvas-capture", marker);

    try {
      const canvas = await html2canvas(el, {
        scale: 1.4,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        onclone: (doc) => {
          // 1) remover regras de CSS com oklch no documento CLONADO
          Array.from(doc.styleSheets || []).forEach((sheet) => {
            try {
              const rules = sheet.cssRules;
              if (!rules) return;
              for (let i = rules.length - 1; i >= 0; i--) {
                const rule = rules[i];
                if (
                  rule &&
                  rule.cssText &&
                  rule.cssText.toLowerCase().includes("oklch(")
                ) {
                  sheet.deleteRule(i);
                }
              }
            } catch {
              // pode dar DOMException (cross-origin), ignoramos
            }
          });

          // 2) encontrar o elemento clonado alvo
          const clonedEl = doc.querySelector(
            `[data-html2canvas-capture="${marker}"]`
          );
          if (!clonedEl) return;

          // 3) limpar atributos style e outros atributos com "oklch(" no clone
          const allNodes = clonedEl.querySelectorAll("*");
          allNodes.forEach((node) => {
            // style attribute
            if (node.hasAttribute("style")) {
              const styleAttr = node.getAttribute("style");
              if (styleAttr && styleAttr.toLowerCase().includes("oklch(")) {
                const safe = styleAttr.replace(
                  /oklch\([^)]*\)/gi,
                  "rgb(255,255,255)"
                );
                node.setAttribute("style", safe);
              }
            }

            // qualquer atributo com oklch
            const attrs = node.getAttributeNames
              ? node.getAttributeNames()
              : [];
            attrs.forEach((attr) => {
              const val = node.getAttribute(attr);
              if (
                typeof val === "string" &&
                val.toLowerCase().includes("oklch(")
              ) {
                node.setAttribute(
                  attr,
                  val.replace(/oklch\([^)]*\)/gi, "rgb(255,255,255)")
                );
              }
            });
          });

          // 4) ajustes visuais de tabela (escala, padding...) no clone
          clonedEl.querySelectorAll("table").forEach((tbl) => {
            tbl.style.transform = "scale(1.3)";
            tbl.style.transformOrigin = "top left";
            tbl.style.width = "calc(100% / 1.3)";

            tbl.querySelectorAll("td, th").forEach((c) => {
              c.style.fontSize = "20px";
              c.style.lineHeight = "1.8";
              c.style.padding = "12px 10px";
            });
          });

          // 5) fallback de cor baseado em computedStyle DO CLONE
          const getCS = doc.defaultView?.getComputedStyle;
          if (getCS) {
            allNodes.forEach((node) => {
              const style = getCS(node);
              ["color", "backgroundColor", "borderColor"].forEach((prop) => {
                const val = style.getPropertyValue(prop);
                if (val && val.toLowerCase().includes("oklch(")) {
                  node.style.setProperty(
                    prop,
                    prop === "backgroundColor" ? "#ffffff" : "#111827",
                    "important"
                  );
                }
              });
            });
          }

          // 6) proteção extra para SVG (Recharts dentro do clone)
          clonedEl.querySelectorAll("svg").forEach((svg) => {
            svg.querySelectorAll("*").forEach((n) => {
              const attrs = n.getAttributeNames ? n.getAttributeNames() : [];
              attrs.forEach((attr) => {
                const val = n.getAttribute(attr);
                if (
                  typeof val === "string" &&
                  val.toLowerCase().includes("oklch(")
                ) {
                  n.setAttribute(
                    attr,
                    val.replace(/oklch\([^)]*\)/gi, "#ffffff")
                  );
                }
              });
            });
          });
        },
      });

      return canvas;
    } finally {
      el.removeAttribute("data-html2canvas-capture");
    }
  };

  /* ========== Geração PDF (cliente, jsPDF + html2canvas) ========== */

  const generatePDF = async () => {
    try {
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
        pdf.text(
          `${periodLabel} · Gerado em ${generatedAt}`,
          margin.left + 25,
          24
        );

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

      const normalize = (s) =>
        s
          ?.toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim();

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

          let fillColor = [108, 141, 180];
          if (occ >= 50) fillColor = [108, 141, 180];
          else fillColor = [239, 68, 68];

          pdf.setFillColor(...fillColor);
          pdf.setDrawColor(...fillColor);
          pdf.roundedRect(x, y, cardWidth, cardHeight, 3, 3, "F");

          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(8.5);
          pdf.text(
            room.name || room.title || `Unidade ${idx + 1}`,
            x + cardWidth / 2,
            y + 9,
            {
              align: "center",
            }
          );

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

          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(12);
          pdf.setTextColor(25, 46, 91);
          pdf.text(
            "Relatório Mensal — Ocupação por Unidade",
            margin.left,
            margin.top + 6
          );

          const usableW = pageWidth - margin.left - margin.right;
          const chartCanvas = await captureElement(chartEl);
          const chartHeight = addImageCentered(
            chartCanvas,
            margin.top + 8,
            usableW * 1.25
          );

          const cardsY = margin.top + chartHeight + 9;
          drawOccupancyCards(pdf, stay, cardsY, usableW);

          const resumoY = pageHeight - margin.bottom - 60;

          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10.5);
          pdf.setTextColor(25, 46, 91);
          pdf.text(`Resumo — ${stay.stayName}`, margin.left, resumoY - 10);

          pdf.setDrawColor(220);
          pdf.setLineWidth(0.2);
          pdf.line(
            margin.left,
            resumoY - 4,
            margin.left + usableW * 0.7,
            resumoY - 4
          );

          const totalDiarias = stay.totalDiarias ?? 0;
          const totalReservas = stay.totalReservas ?? 0;
          const ocupacaoMedia = stay.ocupacaoMedia ?? 0;

          const mediaDiariasReserva =
            totalReservas > 0
              ? (totalDiarias / totalReservas).toFixed(1)
              : "-";

          const unidadeMaisOcupada = stay.rooms?.length
            ? (() => {
                const top = stay.rooms.reduce((a, b) =>
                  (a.ocupacao ?? 0) > (b.ocupacao ?? 0) ? a : b
                );
                return `${
                  top.name || top.title || "—"
                } (${top.ocupacao ?? 0}%)`;
              })()
            : "-";

          const unidadeMenosOcupada = stay.rooms?.length
            ? (() => {
                const low = stay.rooms.reduce((a, b) =>
                  (a.ocupacao ?? 0) < (b.ocupacao ?? 0) ? a : b
                );
                return `${
                  low.name || low.title || "—"
                } (${low.ocupacao ?? 0}%)`;
              })()
            : "-";

          const diasNoMes = dayjs(
            `${selectedYear}-${selectedMonth}-01`
          ).daysInMonth();
          const capacidadeTotal = (stay.rooms?.length ?? 0) * diasNoMes;
          const eficiencia =
            capacidadeTotal > 0
              ? ((totalDiarias / capacidadeTotal) * 100).toFixed(1)
              : "-";

          autoTable(pdf, {
            startY: resumoY,
            theme: "plain",
            body: [
              ["Total de diárias", totalDiarias],
              ["Total de reservas", totalReservas],
              ["Ocupação média (%)", `${ocupacaoMedia}%`],
              ["Média de diárias por reserva", mediaDiariasReserva],
              ["Unidade mais ocupada", unidadeMaisOcupada],
              ["Unidade menos ocupada", unidadeMenosOcupada],
              [
                "Taxa de eficiência (reservas × capacidade)",
                `${eficiencia}%`,
              ],
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
      const slotH = 95;

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
          pdf.addImage(
            chartCanvas.toDataURL("image/png"),
            "PNG",
            dx,
            y,
            w,
            h
          );
          y += h + 4;
          drawFooter(page);
        } catch (e) {
          console.warn("⚠️ Falha anual:", stay.stayName, e);
        }
      }

      pdf.save(
        `Relatorio_Desempenho_${selectedYear}-${String(
          selectedMonth
        ).padStart(2, "0")}.pdf`
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
      className="p-8 space-y-10 bg-gray-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-slate-100"
      ref={reportRef}
      style={{
        fontFamily:
          "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-800 dark:text-slate-50">
            Relatório de Desempenho
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 uppercase tracking-wide">
            {dayjs().month(selectedMonth - 1).format("MMMM").toUpperCase()} /{" "}
            {selectedYear}
          </p>
        </div>

        <div className="flex gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-800 dark:text-slate-100 px-4 py-2 rounded-md shadow-sm"
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
            className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-800 dark:text-slate-100 px-4 py-2 rounded-md w-24 text-center shadow-sm"
            disabled={generating}
          />
          <button
            onClick={printReport}
            className="bg-sky-700 hover:bg-sky-800 text-white px-4 py-2 rounded-md shadow-sm"
          >
            Imprimir / Salvar PDF
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
        <h2 className="text-xl font-semibold text-gray-700 dark:text-slate-100 mb-4 border-b border-gray-300 dark:border-slate-800 pb-1">
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
                  className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-gray-200 dark:border-slate-800"
                  data-chunk="monthly"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-100">
                      {stay.stayName}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-slate-300">
                      Ocupação média:{" "}
                      <span className="text-indigo-600 dark:text-indigo-300 font-medium">
                        {stay.ocupacaoMedia}%
                      </span>{" "}
                      | Reservas:{" "}
                      <span className="text-gray-700 dark:text-slate-100 font-medium">
                        {stay.totalReservas}
                      </span>
                    </p>
                  </div>

                  {/* Container tabela + gráfico */}
                  <div className="flex flex-row gap-6 items-stretch">
                    {/* Tabela */}
                    <div className="basis-[40%]">
                      <div className="overflow-x-auto">
                        <table className="min-w-full border text-sm">
                          <thead className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-100">
                            <tr>
                              <th className="border px-3 py-2 text-left">
                                Unidade
                              </th>
                              <th className="border px-3 py-2 text-center">
                                Ocupado
                              </th>
                              <th className="border px-3 py-2 text-center">
                                Vazio
                              </th>
                              <th className="border px-3 py-2 text-center">
                                Reservas
                              </th>
                              <th className="border px-3 py-2 text-center">
                                Ocupação (%)
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {stay.rooms.map((r, idx) => (
                              <tr
                                key={r.id || `${stay.stayName}-${idx}`}
                                className="bg-white dark:bg-slate-900"
                              >
                                <td className="border px-3 py-2">
                                  {roomDisplayName(r, idx)}
                                </td>
                                <td className="border px-3 py-2 text-center">
                                  {r.ocupado}
                                </td>
                                <td className="border px-3 py-2 text-center">
                                  {r.vazio}
                                </td>
                                <td className="border px-3 py-2 text-center">
                                  {r.reservas ?? 0}
                                </td>
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
                          <span className="font-medium text-gray-700 dark:text-slate-100">
                            Total diárias: {stay.totalDiarias}
                          </span>
                          <span className="font-medium text-gray-700 dark:text-slate-100">
                            Ocupação média: {stay.ocupacaoMedia}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Gráfico */}
                    <div className="basis-[60%] flex justify-center self-center">
                      <div className="h-[320px] w-full flex items-center justify-center bg-white dark:bg-slate-900">
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
                            barSize={
                              (stay.rooms?.length ?? 0) <= 2 ? 90 : undefined
                            }
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#e5e7eb"
                            />
                            <XAxis
                              dataKey="name"
                              stroke="#6b7280"
                              tick={{ fontSize: 12 }}
                              angle={
                                stay.stayName.includes("Internacional Stay")
                                  ? 0
                                  : (stay.rooms?.length ?? 0) > 8
                                  ? -30
                                  : 0
                              }
                              textAnchor={
                                stay.stayName.includes("Internacional Stay")
                                  ? "middle"
                                  : (stay.rooms?.length ?? 0) > 8
                                  ? "end"
                                  : "middle"
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
                            <Bar
                              dataKey="ocupado"
                              fill="#3b82f6"
                              name="Ocupado (%)"
                              fillOpacity={1}
                            />
                            <Bar
                              dataKey="vazio"
                              fill="#ef4444"
                              name="Vazio (%)"
                              fillOpacity={1}
                            />
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
        <h2 className="text-xl font-semibold text-gray-700 dark:text-slate-100 mb-4 border-b border-gray-300 dark:border-slate-800 pb-1">
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
                className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-gray-200 dark:border-slate-800"
                data-chunk="annual"
              >
                <h3 className="text-lg font-semibold text-gray-700 dark:text-slate-100 mb-2">
                  {stay.stayName}
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
                  Ocupação média anual:{" "}
                  <span className="text-indigo-600 dark:text-indigo-300 font-medium">
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
