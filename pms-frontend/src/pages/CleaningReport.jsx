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
  "2025-01-01", "2025-04-18", "2025-04-21", "2025-05-01",
  "2025-09-07", "2025-10-12", "2025-11-02", "2025-11-15", "2025-12-25",
];

function isWeekendOrHoliday(date) {
  const d = dayjs(date);
  return d.day() === 0 || d.day() === 6 || feriadosSP.includes(d.format("YYYY-MM-DD"));
}

export default function RelatorioLimpeza() {
  const api = useApi();
  const [tasks, setTasks] = useState([]);
  const [maids, setMaids] = useState([]);
  const [month, setMonth] = useState(dayjs().format("YYYY-MM"));
  const [extras, setExtras] = useState({});
  const [selectedStays, setSelectedStays] = useState([]);
  const [statusMap, setStatusMap] = useState(new Map()); // chave: `${maidId}|${date}`, valor: "pendente"|"pago"
  const [filtroStatus, setFiltroStatus] = useState("pendente"); // "pendente" | "pago" | "ambos"

  // helpers para statusMap
  const keyStatus = (maidId, dateISO) => `${maidId}|${dateISO}`;
  const getStatus = (maidId, dateISO) => statusMap.get(keyStatus(maidId, dateISO)) || "pendente";
  const setStatusLocal = (maidId, dateISO, status) => {
    setStatusMap(prev => {
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
    const fetchData = async () => {
      const start = dayjs(month).tz("America/Sao_Paulo").startOf("month").format("YYYY-MM-DD");
      const end = dayjs(month).tz("America/Sao_Paulo").endOf("month").format("YYYY-MM-DD");

      const [checkouts, maidsRes, statuses] = await Promise.all([
        api(`/tasks/checkouts?start=${start}&end=${end}`),
        api("/maids"),
        api(`/payments/status?start=${start}&end=${end}`).catch(() => []), // caso ainda não exista no backend
      ]);

      // monta statusMap inicial
      const initialMap = new Map();
      (statuses || []).forEach(s => {
        if (s?.maidId && s?.date && s?.status) {
          initialMap.set(keyStatus(s.maidId, s.date), s.status);
        }
      });
      setStatusMap(prev => {
  const merged = new Map(prev);
  initialMap.forEach((v, k) => merged.set(k, v));
  return merged;
});


      const mapped = checkouts.map((t) => {
        const maidInfo = maidsRes.find((m) => m.id === t.maidId) || null;
        return {
          id: t.id,
          maidId: t.maidId,
          // CORREÇÃO: removido o .add(1,"day")
          date: dayjs.utc(t.date).format("YYYY-MM-DD"),
          stay: t.stay || "Sem Stay",
          rooms: t.rooms || "Sem identificação",
          maid: maidInfo
            ? { name: maidInfo.name, pix: maidInfo.pixKey || "", banco: maidInfo.bank || "" }
            : { name: "Sem diarista", pix: "", banco: "" },
        };
      });

      setTasks(mapped);
      setMaids(maidsRes);
    };
    fetchData();
  }, [api, month]);

  const availableStays = [...new Set(tasks.map((t) => t.stay).filter(Boolean))];

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
    rows = rows.filter(r => r.status === filtroStatus);
  }

  const totalGeral = rows.reduce((acc, r) => acc + r.valor, 0);

  const totaisPorDiarista = rows.reduce((acc, r) => {
    if (!acc[r.diarista]) acc[r.diarista] = { total: 0, dias: 0, pix: r.pix, banco: r.banco };
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
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, 210, 25, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Relatório de Limpeza - ${dayjs(month).format("MMMM/YYYY")}`, 14, 16);

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  let y = 35;

  const pageHeight = doc.internal.pageSize.height;
  
   const diaristasOrdem = Object.keys(totaisPorDiarista).sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" })
  );

  for (const nome of diaristasOrdem) {
    const info = totaisPorDiarista[nome];
    const linhas = rows.filter(r => r.diarista === nome);
    const linhasAltura = linhas.length * 6 + 40; // ~6px por linha + header
    const blocoAltura = 30 + linhasAltura; // margem + subtotal + cabeçalho

    // 👇 se o bloco inteiro não couber, pula pra nova página antes de imprimir
    if (y + blocoAltura > pageHeight - 10) {
      doc.addPage();
      y = 20;
    }

   

    // ==== Cabeçalho do diarista ====
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`${nome}`, 14, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const pix = info.pix || "Não informado";
    const banco = info.banco || "Não informado";
    const ultimo = extras[nome]?.ultimoPagamento || "Não informado";

    doc.text(`Banco: ${banco}`, 14, y);
    y += 5;
    doc.text(`Chave Pix: ${pix}`, 14, y);
    y += 5;
    doc.text(`Último pagamento: ${ultimo}`, 14, y);
    y += 7;

    // ==== Tabela ====
    const tabela = linhas.map(r => [
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
      headStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontSize: 10 },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 14, right: 14 },
      pageBreak: "avoid",
    });

    // posição após a tabela
    y = doc.lastAutoTable.finalY + 10;

    // ==== Subtotal ====
    doc.setFont("helvetica", "bold");
    doc.text(`Subtotal: R$ ${info.total},00`, 14, y);
    y += 15;
  }
    // ==== Total Geral ====
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL GERAL: R$ ${totalGeral},00`, 14, y);
    doc.save(`Relatorio-Limpeza-${month}.pdf`);
 
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
  .filter(r => r.diarista === nome)
  .map(r => dayjs(r.dateISO).format("DD"))
  .sort((a,b) => Number(a) - Number(b));


    doc.text(`Banco: ${banco}`, 14, 40);
    doc.text(`Chave Pix: ${pix}`, 14, 46);
    doc.text(`Dias trabalhados: ${diasTrabalhados.join(", ")}`, 14, 52);
    doc.text(`Total diárias: ${diasTrabalhados.length} dias`, 14, 58);
    doc.text(`Último pagamento: ${ultimo}`, 14, 70);

        const linhas = rows
  .filter(r => r.diarista === nome)
  .map(r => [r.stays, r.rooms, dayjs(r.dateISO).format("DD/MM/YYYY"), `R$ ${r.valor},00`]);

autoTable(doc, {
  head: [["Empreendimento", "Acomodações", "Dia", "Valor"]],
  body: linhas,
  startY: 78,
  theme: "grid",
  headStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontSize: 10 },
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
  <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-8">
    {/* Header */}
    <div className="flex flex-wrap items-center justify-between mb-6">
      <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
        📋 Relatório Mensal de Diaristas
      </h1>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={exportCSV}
          className="btn btn-sm bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
        >
          ⬇ Exportar CSV
        </button>
        <button
          onClick={exportPDF}
          className="btn btn-sm bg-blue-600 text-white border-none hover:bg-blue-700"
        >
          ⬇ Exportar PDF
        </button>
      </div>
    </div>

    {/* Filtros */}
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
      <div className="flex flex-wrap gap-5 items-center">
        {/* Mês */}
        <div className="flex flex-col">
          <label className="text-sm font-semibold text-gray-600 mb-1">
            Mês de referência
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="input input-bordered input-sm w-48"
          />
        </div>

        {/* Status */}
        <div className="flex flex-col">
          <label className="text-sm font-semibold text-gray-600 mb-1">
            Status das diárias
          </label>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="select select-bordered select-sm w-48"
          >
            <option value="pendente">Somente pendentes</option>
            <option value="pago">Somente pagos</option>
            <option value="ambos">Todos</option>
          </select>
        </div>

        {/* Empreendimentos */}
        <div className="flex flex-col flex-1 min-w-[300px]">
          <label className="text-sm font-semibold text-gray-600 mb-1">
            Empreendimentos
          </label>
          <div className="flex flex-wrap gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-28 overflow-y-auto">
            {availableStays.map((s) => (
              <label
                key={s}
                className="flex items-center gap-2 cursor-pointer text-sm text-gray-700"
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
                  className="checkbox checkbox-sm"
                />
                {s}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* Tabela */}
    <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
      <table className="table w-full">
        <thead className="bg-gray-100 text-gray-700 text-sm uppercase font-semibold">
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
                className="hover:bg-gray-50 border-t border-gray-100 text-sm"
              >
                <td className="px-4 py-2 font-medium text-gray-800">
                  {r.diarista}
                </td>
                <td className="px-4 py-2 text-gray-600">{r.stays}</td>
                <td className="px-4 py-2 text-gray-600">{r.rooms}</td>
                <td className="px-4 py-2 text-center text-gray-700">
                  {r.date}
                </td>
                <td className="px-4 py-2 text-center font-semibold text-gray-800">
                  R$ {r.valor},00
                </td>
                <td className="px-4 py-2 text-center">
                  <select
                    className={`select select-xs rounded-md ${
                      r.status === "pago"
                        ? "bg-green-50 border-green-500 text-green-700"
                        : "bg-yellow-50 border-yellow-500 text-yellow-700"
                    }`}
                    value={r.status}
                    onChange={(e) =>
                      handleChangeStatusRow(r.maidId, r.dateISO, e.target.value)
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
                className="text-center text-gray-400 py-8 text-sm"
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
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-all"
        >
          <h3 className="font-semibold text-lg text-gray-800 mb-3 flex items-center justify-between">
            {d}
            <span className="text-sm font-normal text-gray-500">
              {totaisPorDiarista[d].dias} dia(s)
            </span>
          </h3>

          <div className="space-y-2">
            <input
              type="text"
              className="input input-sm input-bordered w-full bg-gray-100 text-gray-700"
              value={totaisPorDiarista[d].banco || "Não informado"}
              readOnly
            />
            <input
              type="text"
              className="input input-sm input-bordered w-full bg-gray-100 text-gray-700"
              value={totaisPorDiarista[d].pix || "Não informado"}
              readOnly
            />
            <input
              type="text"
              placeholder="Último pagamento"
              className="input input-sm input-bordered w-full"
              value={extras[d]?.ultimoPagamento || ""}
              onChange={(e) =>
                setExtras((prev) => ({
                  ...prev,
                  [d]: { ...prev[d], ultimoPagamento: e.target.value },
                }))
              }
            />
          </div>

          <button
            className="btn btn-sm mt-4 w-full bg-blue-50 text-blue-700 border border-blue-300 hover:bg-blue-100"
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
