import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import dayjs from "dayjs";

// KPI: Ocupação Geral do Mês (linha 3 meses)
// props:
//  - value: mês atual (%)
//  - previous: mês anterior (%)
//  - prev2: 2 meses atrás (%) [opcional]
export default function KpiGaugeOcupacao({ value, previous, prev2 }) {
  const cur = clampPct(value);
  const prev = clampPct(previous ?? cur);
  const prevPrev = clampPct(prev2 ?? prev);

  const diff = cur - prev;

  // meses (labels)
  const m0 = dayjs().format("MMM");
  const m1 = dayjs().subtract(1, "month").format("MMM");
  const m2 = dayjs().subtract(2, "month").format("MMM");

  // ====== Y inteligente FIXO (pedido) ======
  // min = 10, max = 79
  const MIN_Y = 10;
  const MAX_Y = 79;
  const RANGE = Math.max(1, MAX_Y - MIN_Y);

  // ====== Chart sizing ======
  const W = 640;
  const H = 220; // mais alto (menos “achatado”)
  const padX = 34;
  const padY = 26;

  const points = useMemo(() => {
    const xs = [
      padX,
      padX + (W - padX * 2) * 0.5,
      W - padX,
    ];

    const toY = (v) => {
      const t = (MAX_Y - v) / RANGE; // topo = MAX, base = MIN
      return padY + t * (H - padY * 2);
    };

    const vals = [prevPrev, prev, cur];
    return vals.map((v, i) => ({ x: xs[i], y: toY(v), v, label: [m2, m1, m0][i] }));
  }, [cur, prev, prevPrev]);

  // ====== Path (linha + área) ======
  const linePath = useMemo(() => {
    // curva suave simples (quadratic)
    const [p0, p1, p2] = points;
    const c1x = (p0.x + p1.x) / 2;
    const c2x = (p1.x + p2.x) / 2;

    return [
      `M ${p0.x} ${p0.y}`,
      `Q ${c1x} ${p0.y} ${p1.x} ${p1.y}`,
      `Q ${c2x} ${p2.y} ${p2.x} ${p2.y}`,
    ].join(" ");
  }, [points]);

  const areaPath = useMemo(() => {
    const [p0, , p2] = points;
    const baseY = H - padY + 6;
    return `${linePath} L ${p2.x} ${baseY} L ${p0.x} ${baseY} Z`;
  }, [linePath, points]);

  // ====== Tooltip / crosshair ======
  const wrapRef = useRef(null);
  const [hoverIdx, setHoverIdx] = useState(null);
  const [mouseX, setMouseX] = useState(0);

  const onMove = (e) => {
    const el = wrapRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;

    // converte para coord do SVG
    const svgX = (x / r.width) * W;
    setMouseX(svgX);

    // pega ponto mais próximo
    let best = 0;
    let bestD = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - svgX);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHoverIdx(best);
  };

  const onLeave = () => {
    setHoverIdx(null);
  };

  const activeIdx = 2; // mês atual (último ponto)
  const activePoint = points[activeIdx];

  // ====== Visual (cores) ======
  const accent =
    cur >= 80 ? "#0ea5e9" : cur >= 60 ? "#38bdf8" : cur >= 40 ? "#60a5fa" : "#93c5fd";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="
        rounded-3xl p-6 w-full h-full border
        bg-gradient-to-br
        from-white via-slate-50 to-white
        dark:from-slate-950 dark:via-slate-900 dark:to-slate-950
        border-slate-200 dark:border-slate-700/60
        shadow-sm dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]
        transition-colors duration-300
      "
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
              📈 Ocupação Geral do Mês
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            comparação com o mês anterior
          </p>
        </div>

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

      {/* Chart */}
      <div
        ref={wrapRef}
        className="mt-4 relative select-none"
        onMouseMove={onMove}
        onMouseEnter={onMove}
        onMouseLeave={onLeave}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-[200px]"
          role="img"
          aria-label="Ocupação (últimos 3 meses)"
        >
          <defs>
            <linearGradient id="kpiLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="55%" stopColor={accent} />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>

            <linearGradient id="kpiArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
            </linearGradient>

            <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* baseline */}
          <line
            x1={padX}
            y1={H - padY + 6}
            x2={W - padX}
            y2={H - padY + 6}
            stroke="rgba(100,116,139,0.22)"
            className="dark:opacity-70"
            strokeWidth="1"
          />

          {/* crosshair vertical + highlight */}
          {hoverIdx !== null && (
            <>
              <line
                x1={points[hoverIdx].x}
                y1={padY - 4}
                x2={points[hoverIdx].x}
                y2={H - padY + 6}
                stroke="rgba(148,163,184,0.35)"
                strokeWidth="1"
                strokeDasharray="4 6"
              />
              <circle
                cx={points[hoverIdx].x}
                cy={points[hoverIdx].y}
                r="10"
                fill="rgba(99,102,241,0.08)"
              />
            </>
          )}

          {/* area */}
          <path d={areaPath} fill="url(#kpiArea)" />

          {/* glow line */}
          <path
            d={linePath}
            fill="none"
            stroke="url(#kpiLine)"
            strokeWidth="5"
            strokeLinecap="round"
            filter="url(#softGlow)"
            opacity="0.22"
          />

          {/* main line */}
          <path
            d={linePath}
            fill="none"
            stroke="url(#kpiLine)"
            strokeWidth="3.25"
            strokeLinecap="round"
          />

          {/* dots */}
          {points.map((p, idx) => {
            const isActive = idx === activeIdx;
            const isHover = hoverIdx === idx;

            return (
              <g key={idx}>
                {/* ring */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? 7 : 5}
                  fill={isActive ? "white" : "rgba(255,255,255,0.92)"}
                  className="dark:fill-slate-950"
                  opacity={isHover ? 1 : 0.95}
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? 10 : 8}
                  fill="none"
                  stroke={isActive ? accent : "rgba(148,163,184,0.45)"}
                  strokeWidth={isActive ? 2.2 : 1.6}
                  opacity={isHover || isActive ? 0.9 : 0.6}
                />

                {/* pulse only on current month */}
                {isActive && (
                  <>
                    <circle cx={p.x} cy={p.y} r="10" fill="none" stroke={accent} strokeWidth="2" opacity="0.8">
                      <animate attributeName="r" values="10;18;10" dur="1.8s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.55;0.12;0.55" dur="1.8s" repeatCount="indefinite" />
                    </circle>
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip (HTML) */}
        {hoverIdx !== null && (
          <div
            className="
              absolute -top-2
              px-3 py-2 rounded-xl border
              bg-white/95 dark:bg-slate-950/90
              border-slate-200 dark:border-slate-700
              shadow-md
              text-xs text-slate-700 dark:text-slate-100
              backdrop-blur
              pointer-events-none
              whitespace-nowrap
            "
            style={{
              left: `${(points[hoverIdx].x / W) * 100}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {points[hoverIdx].label}
            </div>
            <div className="mt-0.5">
              <span className="font-semibold">{points[hoverIdx].v}%</span>{" "}
              <span className="text-slate-500 dark:text-slate-400">
                (escala {MIN_Y}–{MAX_Y})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* mini-cards inline (compactos) */}
      <div className="mt-2 flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: m2, v: prevPrev },
            { label: m1, v: prev },
            { label: m0, v: cur, active: true },
          ].map((x) => (
            <div
              key={x.label}
              className={`
                flex items-center justify-between
                px-4 py-3 rounded-2xl border
                ${x.active
                  ? "border-slate-400/60 bg-slate-50 dark:bg-slate-950"
                  : "border-slate-200 bg-white dark:bg-slate-900/40 dark:border-slate-700/60"
                }
                transition-colors
              `}
            >
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-wider text-xs text-slate-500 dark:text-slate-400">
                  {x.label}
                </span>
                {x.active && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200">
                    atual
                  </span>
                )}
              </div>

              <div className="text-lg font-extrabold text-slate-900 dark:text-slate-50">
                {x.v}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ===== utils ===== */
function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
