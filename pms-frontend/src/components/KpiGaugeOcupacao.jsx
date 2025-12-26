import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import dayjs from "dayjs";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pct = (n) => {
  const x = Number(n);
  return Number.isFinite(x) ? clamp(Math.round(x), 0, 100) : 0;
};

function buildSmoothPath(points) {
  if (points.length < 2) return "";
  const d = [`M ${points[0].x} ${points[0].y}`];

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

function areaPath(points, baseY) {
  if (!points.length) return "";
  const line = buildSmoothPath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
}

export default function KpiGaugeOcupacao({ value, previous, previous2 }) {
  const cur = pct(value);
  const prev = previous === undefined ? cur : pct(previous);
  const prev2 = previous2 === undefined ? prev : pct(previous2);
  const diff = cur - prev;

  // labels (Oct/Nov/Dec) respeitando locale que você usa no app
  const m2 = dayjs().subtract(2, "month").format("MMM").toUpperCase();
  const m1 = dayjs().subtract(1, "month").format("MMM").toUpperCase();
  const m0 = dayjs().format("MMM").toUpperCase();

  // sparkline
  const W = 520;
  const H = 170;
  const padX = 28;
  const padY = 28;
  const baseY = H - 22;

  const xs = [padX, W / 2, W - padX];

  const toY = (v) => {
    const t = (100 - v) / 100;
    return padY + t * (H - padY * 2);
  };

  const values = [prev2, prev, cur];
  const points = values.map((v, i) => ({ x: xs[i], y: toY(v), v, label: [m2, m1, m0][i] }));

  const lineD = useMemo(() => buildSmoothPath(points), [prev2, prev, cur]);
  const areaD = useMemo(() => areaPath(points, baseY), [prev2, prev, cur]);

  // cores (dark premium)
  const accentA = "#60A5FA"; // blue-400
  const accentB = "#A78BFA"; // violet-400
  const glow = diff >= 0 ? "#34D399" : "#FB7185"; // emerald/pink para “status”, leve

  // tooltip
  const wrapRef = useRef(null);
  const [tip, setTip] = useState(null);
  // tip: {x,y,label,v,isCurrent}

  const onMove = (e, p, isCurrent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setTip({
      x,
      y,
      label: p.label,
      v: p.v,
      isCurrent,
    });
  };

  const onLeave = () => setTip(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="
        rounded-3xl p-6 w-full h-full
        border border-slate-700/60
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950
        shadow-[0_20px_60px_rgba(0,0,0,0.45)]
      "
      ref={wrapRef}
    >
      {/* header */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-slate-100 font-semibold text-lg">📈 Ocupação Geral do Mês</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">comparação com o mês anterior</div>
        </div>

        <div className="text-right">
          <div className="text-4xl font-extrabold text-slate-50 leading-none">
            {cur}%
          </div>
          <div className={`mt-1 text-sm font-semibold ${diff >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {diff >= 0 ? "▲" : "▼"} {Math.abs(diff)}%
          </div>
        </div>
      </div>

      {/* sparkline */}
      <div className="mt-5">
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[140px]">
            <defs>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={accentA} stopOpacity="0.9" />
                <stop offset="100%" stopColor={accentB} stopOpacity="0.9" />
              </linearGradient>

              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentA} stopOpacity="0.22" />
                <stop offset="70%" stopColor={accentB} stopOpacity="0.08" />
                <stop offset="100%" stopColor={accentB} stopOpacity="0" />
              </linearGradient>

              <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="
                    1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 0.55 0
                  "
                />
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* baseline sutil */}
            <line
              x1="14"
              y1={baseY}
              x2={W - 14}
              y2={baseY}
              stroke="rgba(148,163,184,0.18)"
              strokeWidth="1"
            />

            {/* área */}
            <path d={areaD} fill="url(#areaGrad)" />

            {/* linha (animada) */}
            <motion.path
              d={lineD}
              fill="none"
              stroke="url(#lineGrad)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              filter="url(#softGlow)"
            />

            {/* pontos + hover zones */}
            {points.map((p, i) => {
              const isCurrent = i === 2;
              const ring = isCurrent ? 10 : 7;

              return (
                <g key={p.label}>
                  {/* hit area */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="16"
                    fill="transparent"
                    onMouseMove={(e) => onMove(e, p, isCurrent)}
                    onMouseLeave={onLeave}
                    style={{ cursor: "default" }}
                  />

                  {/* glow no ponto atual */}
                  {isCurrent && (
                    <circle cx={p.x} cy={p.y} r="14" fill={glow} opacity="0.14" />
                  )}

                  {/* ring */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={ring}
                    fill="rgba(15,23,42,0.9)"
                    stroke="rgba(226,232,240,0.55)"
                    strokeWidth="2"
                  />

                  {/* core */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isCurrent ? 5.2 : 4.2}
                    fill={isCurrent ? "#E2E8F0" : "rgba(226,232,240,0.85)"}
                    stroke="url(#lineGrad)"
                    strokeWidth="2"
                  />
                </g>
              );
            })}
          </svg>

          {/* tooltip */}
          {tip && (
            <div
              className="
                absolute z-10 pointer-events-none
                -translate-x-1/2 -translate-y-[110%]
                rounded-xl px-3 py-2
                bg-slate-950/95 border border-slate-700/70
                text-slate-100 shadow-lg
              "
              style={{ left: tip.x, top: tip.y }}
            >
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                {tip.label} {tip.isCurrent ? "· Atual" : ""}
              </div>
              <div className="text-base font-bold">{tip.v}%</div>
            </div>
          )}
        </div>

        {/* “chips” dos 3 meses */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: m2, v: prev2, active: false },
            { label: m1, v: prev, active: false },
            { label: m0, v: cur, active: true },
          ].map((x) => (
            <div
              key={x.label}
              className={`
                rounded-2xl px-4 py-3
                border
                ${x.active
                  ? "border-slate-500/60 bg-slate-950"
                  : "border-slate-700/60 bg-slate-900/40"
                }
              `}
            >
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                {x.label}
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <div className="text-xl font-extrabold text-slate-100">
                  {x.v}%
                </div>

                {x.active && (
                  <span className="text-[11px] font-semibold text-slate-300">
                    destaque
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
