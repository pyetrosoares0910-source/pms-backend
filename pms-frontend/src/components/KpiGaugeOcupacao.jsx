import { motion } from "framer-motion";
import dayjs from "dayjs";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function pct(n) {
  const x = Number(n);
  return Number.isFinite(x) ? clamp(Math.round(x), 0, 100) : 0;
}

function buildSmoothPath(points) {
  // Curva suave simples (Catmull-Rom -> Bézier)
  if (points.length < 2) return "";
  const d = [];
  d.push(`M ${points[0].x} ${points[0].y}`);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }

  return d.join(" ");
}

export default function KpiGaugeOcupacao({ value, previous, previous2 }) {
  const cur = pct(value);
  const prev = previous === undefined ? cur : pct(previous);
  const prev2 = previous2 === undefined ? prev : pct(previous2);

  const diff = cur - prev;

  // rótulos (ex.: Oct Nov Dec)
  const m2 = dayjs().subtract(2, "month").format("MMM");
  const m1 = dayjs().subtract(1, "month").format("MMM");
  const m0 = dayjs().format("MMM");

  // Sparkline layout
  const W = 360;
  const H = 120;
  const padX = 18;
  const padY = 14;

  const xs = [padX, W / 2, W - padX];

  const toY = (v) => {
    // 100% no topo, 0% embaixo
    const t = (100 - v) / 100;
    return padY + t * (H - padY * 2);
  };

  const values = [prev2, prev, cur];
  const points = values.map((v, i) => ({ x: xs[i], y: toY(v), v }));

  const path = buildSmoothPath(points);

  const trendColor =
    cur >= 70 ? "#60a5fa" : cur >= 40 ? "#93c5fd" : "#a5b4fc"; // azul claro “premium”

  const dotStroke = "#0b1220"; // contorno escuro no dark
  const gridColor = "rgba(148,163,184,0.35)"; // slate-400/35
  const labelColor = "rgba(148,163,184,0.9)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="card bg-white shadow-md border border-gray-100 rounded-2xl p-6 w-full h-full
                 dark:bg-slate-900 dark:border-slate-700 dark:shadow-lg transition-colors duration-300"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-neutral font-semibold text-lg dark:text-slate-100">
            📈 Ocupação Geral do Mês
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            comparação com o mês anterior
          </p>
        </div>

        {/* KPI grande */}
        <div className="text-right">
          <div className="text-4xl font-extrabold text-slate-900 dark:text-slate-50 leading-none">
            {cur}%
          </div>
          <div
            className={`mt-1 text-sm font-semibold ${diff >= 0 ? "text-emerald-500" : "text-red-500"
              }`}
          >
            {diff >= 0 ? "▲" : "▼"} {Math.abs(diff)}%
          </div>
        </div>
      </div>

      {/* Sparkline */}
      <div className="mt-4">
        <div className="w-full overflow-hidden rounded-xl">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-[110px]"
            role="img"
            aria-label="Tendência de ocupação dos últimos 3 meses"
          >
            {/* grid pontilhado */}
            <g stroke={gridColor} strokeWidth="1" strokeDasharray="3 4">
              {/* horizontais */}
              <line x1="0" y1={H * 0.25} x2={W} y2={H * 0.25} />
              <line x1="0" y1={H * 0.5} x2={W} y2={H * 0.5} />
              <line x1="0" y1={H * 0.75} x2={W} y2={H * 0.75} />
              {/* verticais */}
              <line x1={W * 0.33} y1="0" x2={W * 0.33} y2={H} />
              <line x1={W * 0.66} y1="0" x2={W * 0.66} y2={H} />
            </g>

            {/* linha */}
            <path
              d={path}
              fill="none"
              stroke={trendColor}
              strokeWidth="3.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.95"
            />

            {/* pontos */}
            {points.map((p, i) => {
              const isCurrent = i === 2;
              return (
                <g key={i}>
                  {/* halo no atual */}
                  {isCurrent && (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="9.5"
                      fill={trendColor}
                      opacity="0.18"
                    />
                  )}

                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isCurrent ? "5.5" : "4.5"}
                    fill={trendColor}
                    stroke={dotStroke}
                    strokeWidth="2"
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* labels meses */}
        <div className="mt-1 flex justify-between px-1 text-xs uppercase tracking-wide">
          <span className="text-slate-500 dark:text-slate-400">{m2}</span>
          <span className="text-slate-500 dark:text-slate-400">{m1}</span>
          <span className="text-slate-300 dark:text-slate-200 font-semibold">
            {m0}
          </span>
        </div>

        {/* cards dos 3 meses (igual teu mock) */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: m2, v: prev2, active: false },
            { label: m1, v: prev, active: false },
            { label: m0, v: cur, active: true },
          ].map((x) => (
            <div
              key={x.label}
              className={`rounded-xl border p-3
                ${x.active
                  ? "border-slate-600/40 dark:border-slate-600 bg-slate-900/5 dark:bg-slate-950"
                  : "border-slate-200/70 dark:border-slate-700 bg-white/40 dark:bg-slate-900"
                }`}
            >
              <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {x.label}
              </div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">
                {x.v}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
