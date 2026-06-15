import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  CalendarDays,
  Download,
  FileText,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import api from "../api/axios";

const STAY_ORDER = [
  "Internacional Stay (Urussui)",
  "Iguatemi Stay A (Butanta)",
  "Iguatemi Stay B (Butanta)",
  "Itaim Stay (Tabapua)",
  "Itaim Stay 2 (Tabapua)",
  "JK Stay (Clodomiro)",
  "Estanconfor Vila Olimpia",
];

const monthName = (month, format = "MMMM") => dayjs().month(month - 1).format(format);

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const sortStays = (stays) =>
  [...(stays || [])].sort((a, b) => {
    const ai = STAY_ORDER.findIndex((name) => normalizeText(name) === normalizeText(a.stayName));
    const bi = STAY_ORDER.findIndex((name) => normalizeText(name) === normalizeText(b.stayName));
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pct = (value, digits = 1) => `${toNumber(value).toFixed(digits)}%`;

function roomName(room, index) {
  return room?.title || room?.name || room?.roomNumber || room?.code || `Unidade ${index + 1}`;
}

function filterActiveRooms(stays, rooms) {
  const activeIds = new Set((rooms || []).map((room) => room.id).filter(Boolean));
  if (!activeIds.size) return stays;

  return (stays || []).map((stay) => {
    const stayRooms = stay.rooms || [];
    const hasIds = stayRooms.some((room) => room.id || room.roomId || room.room?.id);
    if (!hasIds) return stay;

    return {
      ...stay,
      rooms: stayRooms.filter((room) => {
        const id = room.id || room.roomId || room.room?.id;
        return !id || activeIds.has(id);
      }),
    };
  });
}

function summarizeMonth(stays) {
  const rooms = [];
  let totalDiarias = 0;
  let totalReservas = 0;
  let capacidadeTotal = 0;

  (stays || []).forEach((stay) => {
    const stayDiarias = toNumber(stay.totalDiarias);
    const stayReservas = toNumber(stay.totalReservas);
    const stayCapacidade =
      toNumber(stay.capacidadeTotal) ||
      (stay.rooms || []).reduce((sum, room) => sum + toNumber(room.capacidade), 0);

    totalDiarias += stayDiarias;
    totalReservas += stayReservas;
    capacidadeTotal += stayCapacidade;

    (stay.rooms || []).forEach((room, index) => {
      rooms.push({
        stayName: stay.stayName,
        roomName: roomName(room, index),
        ocupado: toNumber(room.ocupado),
        vazio: toNumber(room.vazio),
        reservas: toNumber(room.reservas),
        ocupacao: toNumber(room.ocupacao),
      });
    });
  });

  const occupancy = capacidadeTotal > 0 ? (totalDiarias / capacidadeTotal) * 100 : 0;
  const averageStay = totalReservas > 0 ? totalDiarias / totalReservas : 0;
  const sortedRooms = [...rooms].sort((a, b) => b.ocupacao - a.ocupacao);
  const stayRanking = (stays || [])
    .map((stay) => ({
      stayName: stay.stayName,
      ocupacao: toNumber(stay.ocupacaoMedia),
      totalDiarias: toNumber(stay.totalDiarias),
      totalReservas: toNumber(stay.totalReservas),
      capacidadeTotal: toNumber(stay.capacidadeTotal),
      rooms: stay.rooms?.length || 0,
    }))
    .sort((a, b) => b.ocupacao - a.ocupacao);

  return {
    totalDiarias,
    totalReservas,
    capacidadeTotal,
    totalUnidades: rooms.length,
    occupancy,
    averageStay,
    topRoom: sortedRooms[0] || null,
    lowRoom: sortedRooms[sortedRooms.length - 1] || null,
    bestStay: stayRanking[0] || null,
    lowStay: stayRanking[stayRanking.length - 1] || null,
    stayRanking,
    rooms,
  };
}

function buildPortfolioTrend(monthlySeries) {
  return (monthlySeries || []).map((item) => {
    const summary = summarizeMonth(item.stays);
    return {
      month: item.month,
      label: monthName(item.month, "MMM"),
      ocupacao: Number(summary.occupancy.toFixed(1)),
      diarias: summary.totalDiarias,
      reservas: summary.totalReservas,
      capacidade: summary.capacidadeTotal,
    };
  });
}

function buildStayChartData(stays) {
  return (stays || []).map((stay) => ({
    name: stay.stayName,
    ocupacao: toNumber(stay.ocupacaoMedia),
    vagas: Math.max(0, 100 - toNumber(stay.ocupacaoMedia)),
  }));
}

function KpiCard({ icon: Icon, label, value, detail, tone = "sky" }) {
  const tones = {
    sky: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/35 dark:text-sky-100",
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100",
    amber:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-100",
    slate:
      "border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100",
  };

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-[0.14em] opacity-70">{label}</div>
        <Icon size={18} />
      </div>
      <div className="mt-3 text-2xl font-black tracking-tight">{value}</div>
      <div className="mt-1 text-xs font-semibold opacity-75">{detail}</div>
    </div>
  );
}

export default function PerformanceReport2() {
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month() + 1);
  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const [monthlyData, setMonthlyData] = useState(null);
  const [annualData, setAnnualData] = useState(null);
  const [monthlySeries, setMonthlySeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [monthlyRes, annualRes, roomsRes, ...seriesResponses] = await Promise.all([
        api.get(`/reports/performance?month=${selectedMonth}&year=${selectedYear}`),
        api.get(`/reports/performance/annual?year=${selectedYear}`),
        api.get("/rooms"),
        ...Array.from({ length: 12 }, (_, index) =>
          api.get(`/reports/performance?month=${index + 1}&year=${selectedYear}`)
        ),
      ]);

      const rooms = roomsRes.data || [];
      const selectedStays = sortStays(filterActiveRooms(monthlyRes.data?.stays || [], rooms));
      const annualStays = sortStays(annualRes.data?.stays || []);
      const series = seriesResponses.map((response, index) => ({
        month: index + 1,
        stays: sortStays(filterActiveRooms(response.data?.stays || [], rooms)),
      }));

      setMonthlyData({
        month: monthlyRes.data?.month || selectedMonth,
        year: monthlyRes.data?.year || selectedYear,
        stays: selectedStays,
      });
      setAnnualData({
        year: annualRes.data?.year || selectedYear,
        stays: annualStays,
      });
      setMonthlySeries(series);
    } catch (err) {
      console.error("Erro ao carregar relatorio de desempenho 2:", err);
      setError(err?.response?.data?.error || err?.message || "Erro ao carregar relatorio.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear]);

  const summary = useMemo(() => summarizeMonth(monthlyData?.stays || []), [monthlyData]);
  const trendData = useMemo(() => buildPortfolioTrend(monthlySeries), [monthlySeries]);
  const stayChartData = useMemo(() => buildStayChartData(monthlyData?.stays || []), [monthlyData]);

  const annualSummary = useMemo(() => {
    const stays = annualData?.stays || [];
    const totalCapacity = stays.reduce((sum, stay) => sum + toNumber(stay.capacidadeTotal), 0);
    const weighted = stays.reduce(
      (sum, stay) => sum + toNumber(stay.ocupacaoMediaAnual) * toNumber(stay.capacidadeTotal),
      0
    );
    return {
      occupancy: totalCapacity > 0 ? weighted / totalCapacity : 0,
      bestStay: [...stays].sort((a, b) => toNumber(b.ocupacaoMediaAnual) - toNumber(a.ocupacaoMediaAnual))[0],
    };
  }, [annualData]);

  const generatePDF = () => {
    if (!monthlyData || !annualData) return;
    setGenerating(true);

    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;
      const period = `${monthName(selectedMonth).toUpperCase()} / ${selectedYear}`;
      const generatedAt = dayjs().format("DD/MM/YYYY HH:mm");

      const drawHeader = (title) => {
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, 20, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(title, margin, 12);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(`${period}  |  Gerado em ${generatedAt}`, pageWidth - margin, 12, { align: "right" });
      };

      const drawFooter = () => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(`Pagina ${doc.getNumberOfPages()}`, pageWidth - margin, pageHeight - 7, {
          align: "right",
        });
      };

      const drawBar = (x, y, width, value, color) => {
        doc.setFillColor(229, 231, 235);
        doc.roundedRect(x, y, width, 4, 1.3, 1.3, "F");
        doc.setFillColor(...color);
        doc.roundedRect(x, y, Math.max(0, Math.min(width, (width * value) / 100)), 4, 1.3, 1.3, "F");
      };

      drawHeader("Relatorio de Desempenho 2 - Sumario Executivo");
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("Visao consolidada de ocupacao", margin, 36);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(80, 88, 105);
      doc.text("Dados calculados pelos endpoints oficiais de desempenho; PDF gerado diretamente, sem captura de tela.", margin, 43);

      const kpis = [
        ["Ocupacao geral", pct(summary.occupancy), "diarias / capacidade disponivel"],
        ["Diarias ocupadas", String(summary.totalDiarias), "soma do periodo"],
        ["Reservas", String(summary.totalReservas), "reservas com overlap no mes"],
        ["Media diaria/reserva", summary.averageStay.toFixed(1), "permanencia media"],
        ["Unidades", String(summary.totalUnidades), "ativas no periodo"],
      ];

      kpis.forEach((item, index) => {
        const x = margin + index * 54;
        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, 54, 48, 28, 2, 2, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.setTextColor(15, 23, 42);
        doc.text(item[1], x + 4, 66);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(item[0].toUpperCase(), x + 4, 74);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(item[2], x + 4, 79);
      });

      autoTable(doc, {
        startY: 94,
        head: [["Empreendimento", "Ocupacao", "Diarias", "Reservas", "Capacidade", "Unidades"]],
        body: summary.stayRanking.map((stay) => [
          stay.stayName,
          pct(stay.ocupacao),
          stay.totalDiarias,
          stay.totalReservas,
          stay.capacidadeTotal,
          stay.rooms,
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: margin, right: margin },
      });

      let y = doc.lastAutoTable.finalY + 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("Ocupacao mensal por empreendimento", margin, y);
      y += 7;
      summary.stayRanking.forEach((stay) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(stay.stayName, margin, y + 3.5);
        drawBar(72, y, 130, stay.ocupacao, stay.ocupacao >= 60 ? [16, 185, 129] : stay.ocupacao >= 40 ? [245, 158, 11] : [239, 68, 68]);
        doc.setFont("helvetica", "bold");
        doc.text(pct(stay.ocupacao), 207, y + 3.5);
        y += 8;
      });
      drawFooter();

      doc.addPage();
      drawHeader("Relatorio de Desempenho 2 - Detalhamento por Unidade");
      autoTable(doc, {
        startY: 30,
        head: [["Empreendimento", "Unidade", "Ocupado", "Vazio", "Reservas", "Ocupacao"]],
        body: summary.rooms.map((room) => [
          room.stayName,
          room.roomName,
          room.ocupado,
          room.vazio,
          room.reservas,
          pct(room.ocupacao),
        ]),
        styles: { fontSize: 7.5, cellPadding: 1.8 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 5) {
            const value = toNumber(String(data.cell.raw).replace("%", ""));
            if (value >= 60) data.cell.styles.textColor = [5, 150, 105];
            else if (value >= 40) data.cell.styles.textColor = [180, 83, 9];
            else data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = "bold";
          }
        },
      });
      drawFooter();

      doc.addPage();
      drawHeader("Relatorio de Desempenho 2 - Tendencia Anual");
      autoTable(doc, {
        startY: 30,
        head: [["Mes", "Ocupacao geral", "Diarias", "Reservas", "Capacidade"]],
        body: trendData.map((item) => [
          monthName(item.month),
          pct(item.ocupacao),
          item.diarias,
          item.reservas,
          item.capacidade,
        ]),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: margin, right: margin },
      });

      y = doc.lastAutoTable.finalY + 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(`Ocupacao anual ponderada: ${pct(annualSummary.occupancy)}`, margin, y);
      if (annualSummary.bestStay) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(
          `Melhor empreendimento no ano: ${annualSummary.bestStay.stayName} (${pct(annualSummary.bestStay.ocupacaoMediaAnual)})`,
          margin,
          y + 7
        );
      }
      drawFooter();

      doc.save(`Relatorio_Desempenho_2_${selectedYear}-${String(selectedMonth).padStart(2, "0")}.pdf`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen space-y-6 p-4 text-slate-900 dark:text-slate-100 sm:p-6">
      <div className="flex flex-col gap-5 border-b border-slate-200 pb-5 dark:border-slate-800 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-200">
            <BarChart3 size={14} />
            desempenho operacional
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-50">
            Relatorio de Desempenho 2
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            Ocupacao, diarias, reservas e tendencia anual com dados consolidados pelos endpoints oficiais.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Mes
            </label>
            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(Number(event.target.value))}
              disabled={loading || generating}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-950 dark:focus:ring-sky-950/50"
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={month}>
                  {monthName(month)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Ano
            </label>
            <input
              type="number"
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
              disabled={loading || generating}
              className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-950 dark:focus:ring-sky-950/50"
            />
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading || generating}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={generatePDF}
            disabled={loading || generating || Boolean(error)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800 disabled:opacity-60 dark:bg-sky-600 dark:hover:bg-sky-500"
          >
            <Download size={16} />
            {generating ? "Gerando..." : "Gerar PDF"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard icon={TrendingUp} label="Ocupacao geral" value={pct(summary.occupancy)} detail="ponderada por capacidade" tone="emerald" />
        <KpiCard icon={CalendarDays} label="Diarias" value={summary.totalDiarias} detail="dias ocupados no mes" tone="sky" />
        <KpiCard icon={FileText} label="Reservas" value={summary.totalReservas} detail="reservas com overlap" tone="slate" />
        <KpiCard icon={BarChart3} label="Diaria/reserva" value={summary.averageStay.toFixed(1)} detail="permanencia media" tone="amber" />
        <KpiCard icon={TrendingDown} label="Anual ponderado" value={pct(annualSummary.occupancy)} detail="ano selecionado" tone="slate" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black tracking-tight">Ocupacao por empreendimento</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{monthName(selectedMonth)} de {selectedYear}</p>
            </div>
          </div>
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stayChartData} margin={{ top: 12, right: 20, left: 0, bottom: 72 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value) => pct(value)} />
                <Legend />
                <Bar dataKey="ocupacao" name="Ocupacao" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="vagas" name="Vazio" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <h2 className="text-lg font-black tracking-tight">Leitura executiva</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-200">Melhor unidade</div>
              <div className="mt-1 font-black">{summary.topRoom?.roomName || "-"}</div>
              <div className="text-slate-600 dark:text-slate-300">{summary.topRoom?.stayName || "-"} · {pct(summary.topRoom?.ocupacao)}</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-amber-800 dark:text-amber-200">Ponto de atencao</div>
              <div className="mt-1 font-black">{summary.lowRoom?.roomName || "-"}</div>
              <div className="text-slate-600 dark:text-slate-300">{summary.lowRoom?.stayName || "-"} · {pct(summary.lowRoom?.ocupacao)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Melhor empreendimento anual</div>
              <div className="mt-1 font-black">{annualSummary.bestStay?.stayName || "-"}</div>
              <div className="text-slate-600 dark:text-slate-300">{pct(annualSummary.bestStay?.ocupacaoMediaAnual)}</div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-4">
          <h2 className="text-lg font-black tracking-tight">Tendencia anual consolidada</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Ocupacao mensal ponderada por capacidade em cada mes.</p>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
              <Tooltip formatter={(value) => pct(value)} />
              <Line type="monotone" dataKey="ocupacao" name="Ocupacao geral" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-lg font-black tracking-tight">Ranking mensal por empreendimento</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Empreendimento</th>
                <th className="px-4 py-3 text-right">Ocupacao</th>
                <th className="px-4 py-3 text-right">Diarias</th>
                <th className="px-4 py-3 text-right">Reservas</th>
                <th className="px-4 py-3 text-right">Capacidade</th>
                <th className="px-4 py-3 text-right">Unidades</th>
              </tr>
            </thead>
            <tbody>
              {summary.stayRanking.map((stay) => (
                <tr key={stay.stayName} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="px-4 py-3 font-bold">{stay.stayName}</td>
                  <td className="px-4 py-3 text-right font-black text-sky-700 dark:text-sky-200">{pct(stay.ocupacao)}</td>
                  <td className="px-4 py-3 text-right">{stay.totalDiarias}</td>
                  <td className="px-4 py-3 text-right">{stay.totalReservas}</td>
                  <td className="px-4 py-3 text-right">{stay.capacidadeTotal}</td>
                  <td className="px-4 py-3 text-right">{stay.rooms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {loading ? (
        <div className="fixed inset-x-0 bottom-5 mx-auto w-fit rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-lg dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
          Carregando relatorio...
        </div>
      ) : null}
    </div>
  );
}
