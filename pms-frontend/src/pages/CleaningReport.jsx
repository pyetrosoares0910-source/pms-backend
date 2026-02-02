import { useState, useEffect } from "react";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { useApi } from "../lib/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

dayjs.extend(utc);
dayjs.extend(timezone);

const feriadosSP = [
  "2026-01-01", // Confraternização Universal
  "2026-01-25", // Aniversário da Cidade de São Paulo (municipal)
  "2026-04-03", // Paixão de Cristo (Sexta-feira Santa)
  "2026-04-21", // Tiradentes
  "2026-05-01", // Dia do Trabalho
  "2026-06-04", // Corpus Christi (municipal em SP)
  "2026-07-09", // Data Magna do Estado de São Paulo (estadual)
  "2026-09-07", // Independência do Brasil
  "2026-10-12", // Nossa Senhora Aparecida
  "2026-11-02", // Finados
  "2026-11-15", // Proclamação da República
  "2026-11-20", // Dia Nacional de Zumbi e da Consciência Negra
  "2026-12-25", // Natal
];

function isWeekendOrHoliday(date) {
  const d = dayjs(date);
  return (
    d.day() === 0 || d.day() === 6 || feriadosSP.includes(d.format("YYYY-MM-DD"))
  );
}

export default function RelatorioLimpeza() {
  const api = useApi();
  const [tasks, setTasks] = useState([]);
  const [maids, setMaids] = useState([]);
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [endExtra, setEndExtra] = useState(""); // "YYYY-MM-DD" (opcional)
  const [extras, setExtras] = useState({});
  const [selectedStays, setSelectedStays] = useState([]);
  const [statusMap, setStatusMap] = useState(new Map()); // chave: `${maidId}|${date}`, valor: "pendente"|"pago"
  const [filtroStatus, setFiltroStatus] = useState("pendente"); // "pendente" | "pago" | "ambos"

  // helpers para statusMap
  const keyStatus = (maidId, dateISO) => `${maidId}|${dateISO}`;
  const getStatus = (maidId, dateISO) =>
    statusMap.get(keyStatus(maidId, dateISO)) || "pendente";
  const setStatusLocal = (maidId, dateISO, status) => {
    setStatusMap((prev) => {
      const clone = new Map(prev);
      clone.set(keyStatus(maidId, dateISO), status);
      return clone;
    });
  };

  // persiste status no backend (upsert)
  const saveStatus = async (maidId, dateISO, status) => {
    try {
      await api("/payments/status", {
        method: "POST",
        body: JSON.stringify({ maidId, date: dateISO, status }),
      });
      setStatusLocal(maidId, dateISO, status);
    } catch (e) {
      console.error("Falha ao salvar status", e);
      alert("Não foi possível salvar o status. Tente novamente.");
    }
  };

  useEffect(() => {
    let isMounted = true; // evita setState depois que o componente desmonta

    const fetchData = async () => {
      try {
        const start = dayjs(month)
          .tz("America/Sao_Paulo")
          .startOf("month")
          .format("YYYY-MM-DD");
        const end = (endExtra
          ? dayjs(endExtra).tz("America/Sao_Paulo")
          : dayjs(month).tz("America/Sao_Paulo").endOf("month")
        ).format("YYYY-MM-DD");

        const [checkouts, maidsRes, statuses] = await Promise.all([
          api(`/tasks/checkouts?start=${start}&end=${end}`),
          api("/maids"),
          api(`/payments/status?start=${start}&end=${end}`).catch(() => []), // caso ainda não exista no backend
        ]);

        if (!isMounted) return; // interrompe se o componente foi desmontado

        // === Monta statusMap inicial ===
        const initialMap = new Map();
        (statuses || []).forEach((s) => {
          if (s?.maidId && s?.date && s?.status) {
            initialMap.set(keyStatus(s.maidId, s.date), s.status);
          }
        });

        setStatusMap((prev) => {
          const merged = new Map(prev);
          initialMap.forEach((v, k) => merged.set(k, v));
          return merged;
        });

        // === Mapeia checkouts ===
        const mapped = (checkouts || []).map((t) => {
          const maidInfo = maidsRes.find((m) => m.id === t.maidId) || null;
          return {
            id: t.id,
            maidId: t.maidId,
            date: dayjs.utc(t.date).format("YYYY-MM-DD"),
            stay: t.stay || "Sem Stay",
            rooms: t.rooms || "Sem identificação",
            maid: maidInfo
              ? {
                name: maidInfo.name,
                pix: maidInfo.pixKey || "",
                banco: maidInfo.bank || "",
              }
              : { name: "Sem diarista", pix: "", banco: "" },
          };
        });

        setTasks(mapped);
        setMaids(maidsRes);
      } catch (err) {
        console.error("❌ Erro ao carregar dados do relatório de limpeza:", err);
      }
    };

    fetchData();

    return () => {
      isMounted = false; // cleanup para evitar state updates após unmount
    };
  }, [month, endExtra]); //  roda apenas quando o mês muda

  const availableStays = [
    ...new Set(tasks.map((t) => t.stay).filter(Boolean)),
  ];

  const filteredTasks =
    selectedStays.length > 0
      ? tasks.filter((t) => selectedStays.includes(t.stay))
      : tasks;

  // agrupamento por (diarista + date) mantendo maidId para status
  const grouped = {};
  filteredTasks.forEach((t) => {
    const dateISO = dayjs.utc(t.date).format("YYYY-MM-DD");
    const key = `${t.maid.name}-${dateISO}`;
    if (!grouped[key]) {
      grouped[key] = {
        diarista: t.maid.name,
        pix: t.maid.pix,
        banco: t.maid.banco,
        maidId: t.maidId,
        dateISO,
        stays: new Set(),
        rooms: [],
      };
    }
    grouped[key].stays.add(t.stay);
    grouped[key].rooms.push(t.rooms);
  });

  // rows base
  let rows = Object.values(grouped).map((g) => {
    const valor = isWeekendOrHoliday(g.dateISO) ? 280 : 250;
    const status = getStatus(g.maidId, g.dateISO); // pendente|pago
    return {
      diarista: g.diarista,
      pix: g.pix,
      banco: g.banco,
      maidId: g.maidId,
      stays: [...g.stays].join(", "),
      rooms: g.rooms.join(", "),
      dateISO: g.dateISO,
      date: dayjs(g.dateISO).format("DD/MM/YYYY"),
      valor,
      status,
    };
  });

  // aplica filtro de status (pendente/pago/ambos)
  if (filtroStatus !== "ambos") {
    rows = rows.filter((r) => r.status === filtroStatus);
  }

  const totalGeral = rows.reduce((acc, r) => acc + r.valor, 0);

  const totaisPorDiarista = rows.reduce((acc, r) => {
    if (!acc[r.diarista])
      acc[r.diarista] = {
        total: 0,
        dias: 0,
        pix: r.pix,
        banco: r.banco,
      };
    acc[r.diarista].total += r.valor;
    acc[r.diarista].dias += 1;
    return acc;
  }, {});

  // === Export CSV (mantido) ===
  const exportCSV = () => {
    let csv = "Diarista,Empreendimento,Acomodações,Dia,Valor,Status\n";
    rows.forEach((r) => {
      csv += `${r.diarista},"${r.stays}","${r.rooms}",${r.date},${r.valor},${r.status}\n`;
    });
    csv += `\nTOTAL,, , ,${totalGeral}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Relatorio-Limpeza-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // === Export PDF geral (mantendo seu visual + evitando quebrar blocos) ===
  const exportPDF = () => {
    const doc = new jsPDF();

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const periodLabel = dayjs(month).format("MMMM/YYYY");
    const periodoFim = endExtra
      ? dayjs(endExtra).format("DD/MM/YYYY")
      : dayjs(month).endOf("month").format("DD/MM/YYYY");
    const periodoIni = dayjs(month).startOf("month").format("DD/MM/YYYY");

    const margin = { left: 14, right: 14, top: 38, bottom: 16 };

    const drawHeaderPagamento = () => {
      // faixa topo azul
      doc.setFillColor(37, 99, 235); // azul mais “premium”
      doc.rect(0, 0, pageW, 28, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("RELATÓRIO — PAGAMENTO", margin.left, 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(
        `${periodLabel} · Período ${periodoIni} até ${periodoFim}`,
        margin.left,
        24
      );

      // selo “PAGAMENTO”
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(pageW - 72, 8, 58, 14, 2, 2, "F");
      doc.setTextColor(37, 99, 235);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("PAGAMENTO", pageW - 43, 17, { align: "center" });

      // linha
      doc.setDrawColor(230);
      doc.setLineWidth(0.3);
      doc.line(margin.left, 32, pageW - margin.right, 32);

      // reset
      doc.setTextColor(0, 0, 0);
    };

    const drawFooterPagamento = (pageNum) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(140);
      doc.text(`Página ${pageNum}`, pageW - margin.right, pageH - 8, {
        align: "right",
      });
      doc.setTextColor(0, 0, 0);
    };

    let y = margin.top;
    let pageNum = 1;
    drawHeaderPagamento();

    const diaristasOrdem = Object.keys(totaisPorDiarista).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base" })
    );

    for (const nome of diaristasOrdem) {
      const info = totaisPorDiarista[nome];
      const linhas = rows.filter((r) => r.diarista === nome);

      const linhasAltura = linhas.length * 6 + 40;
      const blocoAltura = 30 + linhasAltura;

      // se não couber, nova página COM header
      if (y + blocoAltura > pageH - margin.bottom) {
        drawFooterPagamento(pageNum);
        doc.addPage();
        pageNum++;
        drawHeaderPagamento();
        y = margin.top;
      }

      // ===== Cabeçalho diarista =====
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(nome, margin.left, y);
      y += 6;

      // chip de subtotal (azul claro, discreto)
      doc.setFillColor(219, 234, 254); // blue-100
      doc.roundedRect(pageW - 70, y - 12, 56, 10, 2, 2, "F");
      doc.setTextColor(30, 64, 175); // blue-800
      doc.setFontSize(14);
      doc.text(`R$ ${info.total},00`, pageW - 42, y - 5, { align: "center" });

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);

      const pix = info.pix || "Não informado";
      const banco = info.banco || "Não informado";
      const ultimo = extras[nome]?.ultimoPagamento || "Não informado";

      doc.text(`Banco: ${banco}`, margin.left, y);
      y += 5;
      doc.text(`Chave Pix: ${pix}`, margin.left, y);
      y += 5;
      doc.text(`Último pagamento: ${ultimo}`, margin.left, y);
      y += 7;

      // ===== Tabela =====
      const tabela = linhas.map((r) => [r.stays, r.rooms, r.date, `R$ ${r.valor},00`]);

      autoTable(doc, {
        head: [["Empreendimento", "Acomodações", "Dia", "Valor"]],
        body: tabela,
        startY: y,
        theme: "grid",
        headStyles: {
          fillColor: [219, 234, 254], // azul claro no header
          textColor: [30, 64, 175],
          fontSize: 10,
        },
        bodyStyles: { fontSize: 9, cellPadding: 3 },
        alternateRowStyles: { fillColor: [239, 246, 255] }, // blue-50
        margin: { left: margin.left, right: margin.right },
        pageBreak: "avoid",
      });

      y = doc.lastAutoTable.finalY + 10;

      // ===== Subtotal =====
      doc.setDrawColor(40, 40, 40);
      doc.setLineWidth(0.3);
      doc.line(margin.left, y - 4, 200, y - 4);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(`Subtotal: R$ ${info.total},00`, margin.left, y);
      doc.setTextColor(0, 0, 0);

      y += 15;
    }

    // ===== Total Geral =====
    if (y + 18 > pageH - margin.bottom) {
      drawFooterPagamento(pageNum);
      doc.addPage();
      pageNum++;
      drawHeaderPagamento();
      y = margin.top;
    }

    doc.setFillColor(37, 99, 235);
    doc.roundedRect(margin.left, y, pageW - (margin.left + margin.right), 14, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`TOTAL GERAL: R$ ${totalGeral},00`, pageW / 2, y + 9, { align: "center" });
    doc.setTextColor(0, 0, 0);

    // footer em todas as páginas
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawFooterPagamento(p);
    }

    doc.save(`Relatorio-Limpeza-${month}.pdf`);
  };


  // === Export PDF CONFERÊNCIA (layout bem diferente; mesma lógica de dados) ===
  const exportPDFConferencia = () => {
    const doc = new jsPDF();

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const periodLabel = dayjs(month).format("MMMM/YYYY");
    const periodoFim = endExtra
      ? dayjs(endExtra).format("DD/MM/YYYY")
      : dayjs(month).endOf("month").format("DD/MM/YYYY");
    const periodoIni = dayjs(month).startOf("month").format("DD/MM/YYYY");

    // ===== helpers visuais =====


    const drawHeaderConferencia = () => {
      // faixa topo laranja (bem diferente do azul)
      doc.setFillColor(234, 88, 12); // laranja forte
      doc.rect(0, 0, pageW, 28, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("RELATÓRIO — CONFERÊNCIA", 14, 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(
        `${periodLabel} · Período ${periodoIni} até ${periodoFim}`,
        14,
        24
      );

      // selo “NÃO PAGAR”
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(pageW - 72, 8, 58, 14, 2, 2, "F");
      doc.setTextColor(234, 88, 12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("NÃO PAGAR", pageW - 43, 17, { align: "center" });

      doc.setTextColor(0, 0, 0);

      // linha
      doc.setDrawColor(240);
      doc.setLineWidth(0.3);
      doc.line(14, 32, pageW - 14, 32);
    };

    const drawFooterConferencia = (pageNum) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(
        `Documento para conferência/rateio — Página ${pageNum}`,
        pageW - 14,
        pageH - 8,
        { align: "right" }
      );
      doc.setTextColor(0, 0, 0);
    };

    // ===== Conteúdo =====
    drawHeaderConferencia();


    let y = 40;
    const pageHeight = pageH;

    const diaristasOrdem = Object.keys(totaisPorDiarista).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base" })
    );

    let pageNum = 1;

    for (const nome of diaristasOrdem) {
      const info = totaisPorDiarista[nome];
      const linhas = rows.filter((r) => r.diarista === nome);

      // estima altura do bloco (mesma ideia do teu exportPDF)
      const linhasAltura = linhas.length * 6 + 28;
      const blocoAltura = 16 + linhasAltura + 14;

      if (y + blocoAltura > pageHeight - 16) {
        doc.addPage();
        pageNum++;
        drawHeaderConferencia();
        y = 40;
      }

      // ==== Cabeçalho diarista (diferente do outro) ====
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text(nome, 14, y);
      y += 7;

      // “chip” de subtotal na lateral
      doc.setFillColor(255, 237, 213); // laranja bem claro
      doc.roundedRect(pageW - 70, y - 12, 56, 10, 2, 2, "F");
      doc.setTextColor(124, 45, 18);
      doc.setFontSize(9.5);
      doc.text(`R$ ${info.total},00`, pageW - 42, y - 5, { align: "center" });

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      // ==== Tabela (mesma info do pagamento) ====
      const tabela = linhas.map((r) => [
        r.stays,
        r.rooms,
        r.date,
        `R$ ${r.valor},00`,
      ]);

      autoTable(doc, {
        head: [["Empreendimento", "Acomodações", "Dia", "Valor"]],
        body: tabela,
        startY: y,
        theme: "grid",
        headStyles: {
          fillColor: [255, 237, 213], // laranja claro no header
          textColor: [124, 45, 18],
          fontSize: 10,
        },
        bodyStyles: { fontSize: 9, cellPadding: 3 },
        alternateRowStyles: { fillColor: [255, 247, 237] },
        margin: { left: 14, right: 14 },
        pageBreak: "avoid",
      });

      y = doc.lastAutoTable.finalY + 10;

      // ==== Linha de subtotal (mais evidente) ====
      doc.setDrawColor(234, 88, 12);
      doc.setLineWidth(0.6);
      doc.line(14, y - 4, 90, y - 4);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(234, 88, 12);
      doc.text(`Subtotal (conferência): R$ ${info.total},00`, 14, y);
      doc.setTextColor(0, 0, 0);

      y += 14;
    }

    // ==== Total Geral ====
    if (y + 18 > pageHeight - 16) {
      doc.addPage();
      pageNum++;
      drawHeaderConferencia();
      y = 40;
    }

    doc.setFillColor(234, 88, 12);
    doc.roundedRect(14, y, pageW - 28, 14, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`TOTAL GERAL (conferência): R$ ${totalGeral},00`, pageW / 2, y + 9, {
      align: "center",
    });
    doc.setTextColor(0, 0, 0);

    // rodapé em todas as páginas (inclui a 1ª)
    // (jsPDF não tem evento, então percorremos páginas)
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawFooterConferencia(p);
    }

    doc.save(`Conferencia-Limpeza-${month}${endExtra ? `-ate-${endExtra}` : ""}.pdf`);
  };



  // === Export individual (agora lista dias + total dias, respeitando filtroStatus atual) ===
  const exportIndividualPDF = (nome) => {
    const dados = totaisPorDiarista[nome];
    if (!dados) return;

    const doc = new jsPDF();
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, 210, 25, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`Recibo de Pagamento - ${nome}`, 14, 16);

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    const pix = dados.pix || "Não informado";
    const banco = dados.banco || "Não informado";
    const ultimo = extras[nome]?.ultimoPagamento || "Não informado";

    // dias trabalhados
    const diasTrabalhados = rows
      .filter((r) => r.diarista === nome)
      .map((r) => dayjs(r.dateISO).format("DD"))
      .sort((a, b) => Number(a) - Number(b));

    doc.text(`Banco: ${banco}`, 14, 40);
    doc.text(`Chave Pix: ${pix}`, 14, 46);
    doc.text(`Dias trabalhados: ${diasTrabalhados.join(", ")}`, 14, 52);
    doc.text(`Total diárias: ${diasTrabalhados.length} dias`, 14, 58);
    doc.text(`Último pagamento: ${ultimo}`, 14, 70);

    const linhas = rows
      .filter((r) => r.diarista === nome)
      .map((r) => [
        r.stays,
        r.rooms,
        dayjs(r.dateISO).format("DD/MM/YYYY"),
        `R$ ${r.valor},00`,
      ]);

    autoTable(doc, {
      head: [["Empreendimento", "Acomodações", "Dia", "Valor"]],
      body: linhas,
      startY: 78,
      theme: "grid",
      headStyles: {
        fillColor: [243, 244, 246],
        textColor: [17, 24, 39],
        fontSize: 10,
      },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 14, right: 14 },
    });

    doc.text(`Valor total: R$ ${dados.total},00`, 14, 64);

    doc.save(`Recibo-${nome}-${month}.pdf`);
  };

  // altera status de uma linha (persistente)
  const handleChangeStatusRow = async (maidId, dateISO, newStatus) => {
    // Aplica instantaneamente no front
    setStatusLocal(maidId, dateISO, newStatus);

    // Persiste no backend (sem bloquear UI)
    try {
      await saveStatus(maidId, dateISO, newStatus);
    } catch (e) {
      // Reverte se der erro
      console.error("Falha ao salvar status", e);
      alert("Erro ao salvar status. Revertendo...");
      setStatusLocal(maidId, dateISO, getStatus(maidId, dateISO));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-slate-950 dark:to-slate-950 p-8 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-slate-100 tracking-tight">
          📋 Relatório Mensal de Diaristas
        </h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportCSV}
            className="btn btn-sm bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            ⬇ Exportar CSV
          </button>
          <button
            onClick={exportPDF}
            className="btn btn-sm bg-blue-600 text-white border-none hover:bg-blue-700 dark:bg-sky-600 dark:hover:bg-sky-500"
          >
            ⬇ Exportar PDF
          </button>
          <button
            onClick={exportPDFConferencia}
            className="btn btn-sm bg-orange-600 text-white border-none hover:bg-orange-700 dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            ⬇ PDF Conferência
          </button>

        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 p-5 mb-6">
        <div className="flex flex-wrap gap-5 items-center">
          {/* Mês */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-1">
              Mês de referência
            </label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="input input-bordered input-sm w-48 bg-white/80 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
            />
          </div>

          {/* Até (opcional) */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-1">
              Até (opcional)
            </label>
            <input
              type="date"
              value={endExtra}
              onChange={(e) => setEndExtra(e.target.value)}
              className="input input-bordered input-sm w-48 bg-white/80 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
            />
            {endExtra && (
              <button
                type="button"
                onClick={() => setEndExtra("")}
                className="mt-1 text-xs text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 underline text-left"
              >
                limpar data extra
              </button>
            )}
          </div>

          {/* Status */}
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-1">
              Status das diárias
            </label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="select select-bordered select-sm w-48 bg-white/80 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
            >
              <option value="pendente">Somente pendentes</option>
              <option value="pago">Somente pagos</option>
              <option value="ambos">Todos</option>
            </select>
          </div>

          {/* Empreendimentos */}
          <div className="flex flex-col flex-1 min-w-[300px]">
            <label className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-1">
              Empreendimentos
            </label>
            <div className="flex flex-wrap gap-3 bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 rounded-xl p-3 max-h-28 overflow-y-auto">
              {availableStays.map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-slate-200"
                >
                  <input
                    type="checkbox"
                    checked={selectedStays.includes(s)}
                    onChange={() => {
                      setSelectedStays((prev) =>
                        prev.includes(s)
                          ? prev.filter((stay) => stay !== s)
                          : [...prev, s]
                      );
                    }}
                    className="checkbox checkbox-sm checkbox-primary"
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-gray-200 dark:border-slate-800 overflow-hidden">
        <table className="table w-full table-auto">
          <thead className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-100 text-sm uppercase font-semibold">
            <tr>
              <th className="px-4 py-3 text-left">Diarista</th>
              <th className="px-4 py-3 text-left">Empreendimento</th>
              <th className="px-4 py-3 text-left">Acomodações</th>
              <th className="px-4 py-3 text-center">Dia</th>
              <th className="px-4 py-3 text-center">Valor</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((r, idx) => (
                <tr
                  key={`${r.maidId}-${r.dateISO}-${idx}`}
                  className="hover:bg-gray-50 dark:hover:bg-slate-800 border-t border-gray-100 dark:border-slate-800 text-sm"
                >
                  <td className="px-4 py-2 font-medium text-gray-800 dark:text-slate-100">
                    {r.diarista}
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-slate-300">
                    {r.stays}
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-slate-300">
                    {r.rooms}
                  </td>
                  <td className="px-4 py-2 text-center text-gray-700 dark:text-slate-200">
                    {r.date}
                  </td>
                  <td className="px-4 py-2 text-center font-semibold text-gray-800 dark:text-slate-100">
                    R$ {r.valor},00
                  </td>
                  <td className="px-4 py-2 text-center">
                    <select
                      className={`select select-xs rounded-md ${r.status === "pago"
                        ? "bg-green-50 border-green-500 text-green-700 dark:bg-emerald-900/40 dark:border-emerald-400 dark:text-emerald-200"
                        : "bg-yellow-50 border-yellow-500 text-yellow-700 dark:bg-amber-900/40 dark:border-amber-400 dark:text-amber-200"
                        }`}
                      value={r.status}
                      onChange={(e) =>
                        handleChangeStatusRow(
                          r.maidId,
                          r.dateISO,
                          e.target.value
                        )
                      }
                    >
                      <option value="pendente">Pendente</option>
                      <option value="pago">Pago</option>
                    </select>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan="6"
                  className="text-center text-gray-400 dark:text-slate-500 py-8 text-sm"
                >
                  Nenhum registro encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cards individuais */}
      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Object.keys(totaisPorDiarista).map((d) => (
          <div
            key={d}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 p-5 hover:shadow-md dark:hover:shadow-slate-900/70 transition-all"
          >
            <h3 className="font-semibold text-lg text-gray-800 dark:text-slate-100 mb-3 flex items-center justify-between">
              {d}
              <span className="text-sm font-normal text-gray-500 dark:text-slate-400">
                {totaisPorDiarista[d].dias} dia(s)
              </span>
            </h3>

            <div className="space-y-2">
              <input
                type="text"
                className="input input-sm input-bordered w-full bg-gray-100 dark:bg-slate-800 dark:border-slate-700 text-gray-700 dark:text-slate-100"
                value={totaisPorDiarista[d].banco || "Não informado"}
                readOnly
              />
              <input
                type="text"
                className="input input-sm input-bordered w-full bg-gray-100 dark:bg-slate-800 dark:border-slate-700 text-gray-700 dark:text-slate-100"
                value={totaisPorDiarista[d].pix || "Não informado"}
                readOnly
              />
              <input
                type="text"
                placeholder="Último pagamento"
                className="input input-sm input-bordered w-full bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                value={extras[d]?.ultimoPagamento || ""}
                onChange={(e) =>
                  setExtras((prev) => ({
                    ...prev,
                    [d]: {
                      ...prev[d],
                      ultimoPagamento: e.target.value,
                    },
                  }))
                }
              />
            </div>

            <button
              className="btn btn-sm mt-4 w-full bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100 dark:bg-sky-900/60 dark:text-sky-200 dark:border-sky-500 dark:hover:bg-sky-900"
              onClick={() => exportIndividualPDF(d)}
            >
              ⬇ PDF Individual
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
