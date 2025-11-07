import { motion } from "framer-motion";

export default function KpiGaugeOcupacao({ value, previous }) {
  const pct = Number(value) || 0;
  const pctPrev = Number(previous) || pct;
  const diff = pct - pctPrev;

  // Cor do progresso
  const pathColor =
    pct >= 80 ? "#0ea5e9" : pct >= 60 ? "#38bdf8" : pct >= 40 ? "#60a5fa" : "#93c5fd";

  const circumference = 260; 
  const offset = circumference - (circumference * pct) / 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="card bg-white shadow-md border border-gray-100 rounded-2xl p-6 flex flex-col items-center justify-center w-full h-full"
    >
      <h2 className="text-neutral font-semibold text-lg mb-4">
        📈 Ocupação Geral do Mês
      </h2>

      <div className="relative w-40 h-40">
        <svg className="w-full h-full -rotate-90">
          {/* Fundo */}
          <circle
            cx="80"
            cy="80"
            r="70"
            stroke="#e5e7eb"
            strokeWidth="12"
            fill="none"
          />

          {/* Progresso com animação */}
          <motion.circle
            cx="80"
            cy="80"
            r="70"
            stroke={pathColor}
            strokeWidth="12"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            strokeLinecap="round"
          />
        </svg>

        {/* Valor central */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-extrabold text-neutral">
            {pct}%
          </span>

          {previous !== undefined && (
            <span
              className={`mt-1 text-sm font-semibold ${
                diff >= 0 ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {diff >= 0 ? "▲" : "▼"} {Math.abs(diff)}%
            </span>
          )}
        </div>
      </div>

      {previous !== undefined && (
        <p className="text-xs text-gray-500 mt-3">
          comparação com o mês anterior
        </p>
      )}
    </motion.div>
  );
}
