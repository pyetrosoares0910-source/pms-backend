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
  const [selectedStays, setSelectedStays] = useState([]); // 👈 filtro multi-select

  useEffect(() => {
    const fetchData = async () => {
      const start = dayjs(month).tz("America/Sao_Paulo").startOf("month").format("YYYY-MM-DD");
      const end = dayjs(month).tz("America/Sao_Paulo").endOf("month").format("YYYY-MM-DD");

      const [checkouts, maidsRes] = await Promise.all([
        api(`/tasks/checkouts?start=${start}&end=${end}`),
        api("/maids"),
      ]);

      const mapped = checkouts.map((t) => {
        const maidInfo = maidsRes.find((m) => m.id === t.maidId) || null;
        return {
          id: t.id,
          date: dayjs.utc(t.date).add(1, "day").format("YYYY-MM-DD"),
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

  // stays únicos para popular o filtro
  const availableStays = [...new Set(tasks.map((t) => t.stay).filter(Boolean))];

  // aplica o filtro de empreendimentos
  const filteredTasks =
    selectedStays.length > 0
      ? tasks.filter((t) => selectedStays.includes(t.stay))
      : tasks;

  // agrupamento
  const grouped = {};
  filteredTasks.forEach((t) => {
    const date = dayjs.utc(t.date).format("YYYY-MM-DD");
    const key = `${t.maid.name}-${date}`;
    if (!grouped[key]) {
      grouped[key] = {
        diarista: t.maid.name,
        pix: t.maid.pix,
        banco: t.maid.banco,
        date,
        stays: new Set(),
        rooms: [],
      };
    }
    grouped[key].stays.add(t.stay);
    grouped[key].rooms.push(t.rooms);
  });

  const rows = Object.values(grouped).map((g) => {
    const valor = isWeekendOrHoliday(g.date) ? 280 : 250;
    return {
      diarista: g.diarista,
      pix: g.pix,
      banco: g.banco,
      stays: [...g.stays].join(", "),
      rooms: g.rooms.join(", "),
      date: dayjs(g.date).format("DD/MM/YYYY"),
      valor,
    };
  });

  const totalGeral = rows.reduce((acc, r) => acc + r.valor, 0);
  const totaisPorDiarista = rows.reduce((acc, r) => {
    if (!acc[r.diarista]) acc[r.diarista] = { total: 0, dias: 0, pix: r.pix, banco: r.banco };
    acc[r.diarista].total += r.valor;
    acc[r.diarista].dias += 1;
    return acc;
  }, {});

  // === Export CSV ===
  const exportCSV = () => {
    let csv = "Diarista,Empreendimento,Acomodações,Dia,Valor\n";
    rows.forEach((r) => {
      csv += `${r.diarista},"${r.stays}","${r.rooms}",${r.date},${r.valor}\n`;
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

  // === Export PDF geral ===
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

    Object.entries(totaisPorDiarista).forEach(([nome, info]) => {
      if (y > 240) {
        doc.addPage();
        y = 20;
      }

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

      const linhas = rows.filter((r) => r.diarista === nome).map((r) => [
        r.stays,
        r.rooms,
        r.date,
        `R$ ${r.valor},00`,
      ]);

      autoTable(doc, {
        head: [["Empreendimento", "Acomodações", "Dia", "Valor"]],
        body: linhas,
        startY: y,
        theme: "grid",
        headStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontSize: 10 },
        bodyStyles: { fontSize: 9, cellPadding: 3 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { left: 14, right: 14 },
      });

      y = doc.lastAutoTable.finalY + 10;
      doc.setFont("helvetica", "bold");
      doc.text(`Subtotal: R$ ${info.total},00`, 14, y);
      y += 15;
    });

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL GERAL: R$ ${totalGeral},00`, 14, y);

    doc.save(`Relatorio-Limpeza-${month}.pdf`);
  };

  // === Export individual ===
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

    doc.text(`Banco: ${banco}`, 14, 40);
    doc.text(`Chave Pix: ${pix}`, 14, 46);
    doc.text(`Dias trabalhados: ${dados.dias}`, 14, 52);
    doc.text(`Total: R$ ${dados.total},00`, 14, 58);
    doc.text(`Último pagamento: ${ultimo}`, 14, 64);

    doc.save(`Recibo-${nome}-${month}.pdf`);
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Relatório Mensal de Diaristas</h1>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="btn btn-outline btn-sm">⬇ CSV</button>
          <button onClick={exportPDF} className="btn btn-outline btn-sm">⬇ PDF</button>
        </div>
      </div>

      {/* Filtros */}
<div className="flex flex-wrap gap-4 items-center">
  {/* filtro mês */}
  <input
    type="month"
    value={month}
    onChange={(e) => setMonth(e.target.value)}
    className="input input-bordered"
  />

  {/* checkboxes de empreendimentos */}
  <div className="flex flex-wrap gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
    {availableStays.map((s) => (
      <label key={s} className="flex items-center gap-2 cursor-pointer">
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
        <span className="text-sm text-gray-700">{s}</span>
      </label>
    ))}
  </div>
</div>


      {/* Tabela */}
      <div className="overflow-x-auto bg-white rounded-2xl shadow-md border border-gray-200 mt-4">
        <table className="table w-full">
          <thead className="bg-gray-100 text-gray-700 uppercase text-sm">
            <tr>
              <th>Diarista</th>
              <th>Empreendimento</th>
              <th>Acomodações</th>
              <th>Dia</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((r, idx) => (
                <tr key={idx}>
                  <td>{r.diarista}</td>
                  <td>{r.stays}</td>
                  <td>{r.rooms}</td>
                  <td>{r.date}</td>
                  <td>R$ {r.valor},00</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="text-center text-gray-400 py-4">
                  Nenhum registro encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cards individuais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {Object.keys(totaisPorDiarista).map((d) => (
          <div key={d} className="card bg-white shadow p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-2">{d}</h3>
            <input
              type="text"
              className="input input-sm input-bordered w-full mb-2 bg-gray-100"
              value={totaisPorDiarista[d].banco || "Não informado"}
              readOnly
            />
            <input
              type="text"
              className="input input-sm input-bordered w-full mb-2 bg-gray-100"
              value={totaisPorDiarista[d].pix || "Não informado"}
              readOnly
            />
            <input
              type="text"
              placeholder="Último pagamento"
              className="input input-sm input-bordered w-full mb-2"
              value={extras[d]?.ultimoPagamento || ""}
              onChange={(e) =>
                setExtras((prev) => ({
                  ...prev,
                  [d]: { ...prev[d], ultimoPagamento: e.target.value },
                }))
              }
            />
            <button
              className="btn btn-sm btn-outline w-full"
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
