import { motion } from "framer-motion";
import dayjs from "dayjs";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default function KpiGaugeOcupacao({ value, previous, previous2 }) {
  const pct = clamp(Number(value) || 0, 0, 100);
  const pctPrev = clamp(Number(previous) ?? pct, 0, 100);
  const pctPrev2 = clamp(Number(previous2) ?? pctPrev, 0, 100);

  const diff = pct - pctPrev;

  const currentLabel = dayjs().format("MMM");
  const prevLabel = dayjs().subtract(1, "month").format("MMM");
  const prev2Label = dayjs().subtract(2, "month").format("MMM");

  // mesma lógica de “azul” que você já curte
  const accent =
    pct >= 80
      ? "bg-sky-500"
      : pct >= 60
        ? "bg-sky-400"
        : pct >= 40
          ? "bg-blue-400"
          : "bg-blue-300";

  const accentText =
    pct >= 80
      ? "text-sky-500"
      : pct >= 60
        ? "text-sky-400"
        : pct >= 40
          ? "text-blue-400"
          : "text-blue-300";

  const Trend = () =>
    previous !== undefined ? (
      <span
        className={`text-sm font-semibold ${diff >= 0 ? "text-emerald-500" : "text-red-500"
          }`}
      >
        {diff >= 0 ? "▲" : "▼"} {Math.abs(diff)}%
      </span>
    ) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="card bg-white shadow-md border border-gray-100 rounded-2xl p-6 w-full h-full dark:bg-slate-900 dark:border-slate-700 dark:shadow-lg transition-colors duration-300"
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-neutral font-semibold text-lg dark:text-slate-100">
            📈 Ocupação Geral do Mês
          </h2>
          <p className="text-xs text-gray-500 mt-1 dark:text-slate-400">
            comparação com o mês anterior
          </p>
        </div>

        <div className="text-right">
          <div className="text-4xl font-extrabold text-neutral dark:text-slate-50 leading-none">
            {pct}%
          </div>
          <div className="mt-1">
            <Trend />
          </div>
        </div>
      </div>

      {/* trilho */}
      <div className="relative">
        <div className="h-3 rounded-full bg-gray-200 dark:bg-slate-800 overflow-hidden">
          {/* preenchimento até o mês atual */}
          <motion.div
            className={`h-full ${accent}`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        </div>

        {/* marcadores (posicionados por %) */}
        <Marker value={pctPrev2} label={prev2Label} />
        <Marker value={pctPrev} label={prevLabel} />
        <CurrentMarker value={pct} label={currentLabel} accentText={accentText} />
      </div>

      {/* legenda curta */}
      <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-gray-600 dark:text-slate-300">
        <LegendItem label={prev2Label} value={pctPrev2} />
        <LegendItem label={prevLabel} value={pctPrev} />
        <LegendItem label={currentLabel} value={pct} strong />
      </div>
    </motion.div>
  );
}

function Marker({ value, label }) {
  const left = `${value}%`;
  return (
    <div className="absolute -top-2" style={{ left, transform: "translateX(-50%)" }}>
      <div className="w-2.5 h-2.5 rounded-full bg-gray-500 dark:bg-slate-400 shadow" />
      <div className="mt-1 text-[10px] text-gray-500 dark:text-slate-400 text-center">
        {label}
      </div>
    </div>
  );
}

function CurrentMarker({ value, label, accentText }) {
  const left = `${value}%`;
  return (
    <div className="absolute -top-4" style={{ left, transform: "translateX(-50%)" }}>
      <div className="w-4 h-4 rounded-full bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-600 shadow flex items-center justify-center">
        <div className={`w-2.5 h-2.5 rounded-full ${accentText.replace("text-", "bg-")}`} />
      </div>
      <div className={`mt-1 text-[11px] font-semibold ${accentText} text-center`}>
        {label}
      </div>
    </div>
  );
}

function LegendItem({ label, value, strong }) {
  return (
    <div className={`rounded-xl border border-gray-200 dark:border-slate-800 p-3 ${strong ? "bg-gray-50 dark:bg-slate-950" : "bg-white dark:bg-slate-900"}`}>
      <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-slate-400">
        {label}
      </div>
      <div className={`mt-1 ${strong ? "text-base font-bold" : "text-sm font-semibold"} text-slate-900 dark:text-slate-100`}>
        {value}%
      </div>
    </div>
  );
}
