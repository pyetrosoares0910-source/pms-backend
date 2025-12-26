import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function PremiumIcon() {
  // ícone “premium” (quadradinho com brilho) no estilo do seu print
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl
      bg-gradient-to-br from-sky-500/25 via-indigo-500/20 to-fuchsia-500/20
      border border-white/10 dark:border-white/10
      shadow-[0_10px_30px_rgba(56,189,248,0.10)]"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2l1.2 4.3L18 8l-4.8 1.7L12 14l-1.2-4.3L6 8l4.8-1.7L12 2Z"
          stroke="currentColor"
          className="text-sky-300 dark:text-sky-200"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M19 13l.7 2.4L22 16l-2.3.6L19 19l-.7-2.4L16 16l2.3-.6L19 13Z"
          stroke="currentColor"
          className="text-indigo-300 dark:text-indigo-200"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default function KpiOcupacaoTrend({ data }) {
  // data: [{label:'OCT', value:51},{label:'NOV',value:69},{label:'DEC',value:37}]
  const points = Array.isArray(data) ? data.slice(-3) : [];
  const curIdx = Math.max(0, points.length - 1);

  const pct = Number(points?.[curIdx]?.value ?? 0) || 0;
  const pctPrev = Number(points?.[curIdx - 1]?.value ?? pct) || pct;
  const diff = pct - pctPrev;

  // escala Y fixa (pedido): 10–79
  const Y_MIN = 10;
  const Y_MAX = 79;

  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null); // { idx, x, y }

  const dims = useMemo(
    () => ({ w: 760, h: 200, padX: 26, padTop: 18, padBottom: 30 }),
    []
  );

  const safeVals = useMemo(
    () => points.map((p) => clamp(Number(p.value) || 0, Y_MIN, Y_MAX)),
    [points]
  );

  const xAt = (i) => {
    const usable = dims.w - dims.padX * 2;
    const step = points.length <= 1 ? 0 : usable / (points.length - 1);
    return dims.padX + i * step;
  };

  const yAt = (v) => {
    const usable = dims.h - dims.padTop - dims.padBottom;
    const t = (v - Y_MIN) / (Y_MAX - Y_MIN || 1);
    return dims.padTop + (1 - t) * usable;
  };

  const coords = useMemo(() => {
    return safeVals.map((v, i) => ({ x: xAt(i), y: yAt(v), v, label: points[i]?.label }));
  }, [safeVals, points, dims]);

  const pathD = useMemo(() => {
    if (coords.length === 0) return "";
    if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;

    // curva suave (Catmull-Rom -> Bezier)
    const pts = coords.map((p) => [p.x, p.y]);
    const alpha = 0.5;

    const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;

    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const d1 = Math.pow(dist(p0, p1), alpha);
      const d2 = Math.pow(dist(p1, p2), alpha);
      const d3 = Math.pow(dist(p2, p3), alpha);

      const b1 = [
        p2[0] - (d2 * (p3[0] - p1[0])) / (d2 + d3),
        p2[1] - (d2 * (p3[1] - p1[1])) / (d2 + d3),
      ];
      const b2 = [
        p1[0] + (d2 * (p2[0] - p0[0])) / (d1 + d2),
        p1[1] + (d2 * (p2[1] - p0[1])) / (d1 + d2),
      ];

      d += ` C ${b2[0]} ${b2[1]}, ${b1[0]} ${b1[1]}, ${p2[0]} ${p2[1]}`;
    }
    return d;
  }, [coords]);

  const areaD = useMemo(() => {
    if (!pathD || coords.length === 0) return "";
    const last = coords[coords.length - 1];
    const first = coords[0];
    const baseY = dims.h - dims.padBottom;
    return `${pathD} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
  }, [pathD, coords, dims]);

  const onMove = (e) => {
    if (!wrapRef.current || coords.length === 0) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, rect.width);
    // converte x para espaço do SVG (viewBox)
    const scaleX = dims.w / rect.width;
    const sx = x * scaleX;

    // pega o ponto mais próximo
    let best = 0;
    let bestDist = Infinity;
    coords.forEach((p, i) => {
      const d = Math.abs(p.x - sx);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });

    const p = coords[best];
    setHover({ idx: best, x: p.x, y: p.y, v: points[best]?.value, label: points[best]?.label });
  };

  const onLeave = () => setHover(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="
        w-full h-full rounded-2xl p-6
        border border-slate-200/70 dark:border-white/10
        bg-white dark:bg-slate-900
        shadow-[0_20px_60px_rgba(2,6,23,0.12)] dark:shadow-[0_30px_90px_rgba(0,0,0,0.35)]
        transition-colors
      "
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <PremiumIcon />
          <div>
            <h2 className="text-[18px] font-semibold text-slate-800 dark:text-slate-100 leading-tight">
              Ocupação Geral do Mês
            </h2>
            <p className="text-[12px] text-slate-600 dark:text-slate-400 mt-1">
              comparação com o mês anterior
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[40px] font-extrabold text-slate-800 dark:text-slate-50 leading-none">
            {pct}%
          </div>
          <div
            className={`mt-1 text-[13px] font-semibold ${diff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              }`}
          >
            {diff >= 0 ? "▲" : "▼"} {Math.abs(diff)}%
          </div>
        </div>
      </div>

      {/* Chart */}
      <div
        ref={wrapRef}
        className="mt-5 rounded-2xl relative overflow-hidden"
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        <div
          className="
            absolute inset-0
            bg-gradient-to-b from-slate-100/70 to-white/0
            dark:from-white/5 dark:to-white/0
          "
        />

        <svg
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          className="relative w-full h-[220px] lg:h-[240px]"
        >
          <defs>
            <linearGradient id="kpiLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(56,189,248,1)" />
              <stop offset="55%" stopColor="rgba(129,140,248,1)" />
              <stop offset="100%" stopColor="rgba(168,85,247,1)" />
            </linearGradient>

            <linearGradient id="kpiArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(99,102,241,0.26)" />
              <stop offset="80%" stopColor="rgba(99,102,241,0.00)" />
            </linearGradient>

            <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values="
                  1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 .35 0"
              />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* régua vertical do tooltip */}
          {hover && (
            <line
              x1={hover.x}
              y1={dims.padTop}
              x2={hover.x}
              y2={dims.h - dims.padBottom}
              stroke="rgba(148,163,184,0.45)"
              strokeDasharray="4 6"
            />
          )}

          {/* Área */}
          {areaD && (
            <path d={areaD} fill="url(#kpiArea)" />
          )}

          {/* Linha (com glow + animação) */}
          <motion.path
            d={pathD}
            fill="none"
            stroke="url(#kpiLine)"
            strokeWidth="4"
            strokeLinecap="round"
            filter="url(#softGlow)"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.0, ease: "easeOut" }}
          />

          {/* ponto pulsante APENAS no mês atual */}
          {coords[curIdx] && (
            <>
              {/* halo pulsante */}
              <motion.circle
                cx={coords[curIdx].x}
                cy={coords[curIdx].y}
                r="10"
                fill="rgba(99,102,241,0.18)"
                initial={{ opacity: 0.0, scale: 0.9 }}
                animate={{ opacity: [0.0, 0.75, 0.0], scale: [0.85, 1.35, 0.85] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
              {/* ponto pequeno */}
              <circle
                cx={coords[curIdx].x}
                cy={coords[curIdx].y}
                r="5"
                fill="rgba(15,23,42,0.95)"
                className="dark:fill-slate-950"
              />
              <circle
                cx={coords[curIdx].x}
                cy={coords[curIdx].y}
                r="5"
                fill="transparent"
                stroke="rgba(147,197,253,0.95)"
                strokeWidth="2.5"
              />
            </>
          )}
        </svg>

        {/* Tooltip */}
        {hover && (
          <div
            className="
              absolute top-3 right-4
              rounded-xl px-3 py-2
              bg-white/90 dark:bg-slate-950/85
              border border-slate-200/70 dark:border-white/10
              shadow-lg
              backdrop-blur
            "
          >
            <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
              {hover.label}
            </div>
            <div className="text-[13px] font-bold text-slate-900 dark:text-slate-50">
              {hover.v}%{" "}
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                (escala {Y_MIN}–{Y_MAX})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Cards compactos */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {points.map((p, i) => {
          const isCurrent = i === curIdx;
          return (
            <div
              key={`${p.label}-${i}`}
              className={`
                rounded-2xl px-4 py-3
                border
                ${isCurrent
                  ? "border-sky-300/40 dark:border-indigo-300/20 bg-sky-50/60 dark:bg-white/5"
                  : "border-slate-200/70 dark:border-white/10 bg-white/60 dark:bg-white/3"}
              `}
            >
              <div className="flex items-center justify-between">
                <div className="text-[12px] tracking-wide text-slate-600 dark:text-slate-400">
                  {p.label}
                  {isCurrent && (
                    <span className="ml-2 text-[11px] px-2 py-[2px] rounded-full
                      bg-sky-500/15 text-sky-700 dark:text-sky-200 dark:bg-sky-500/15"
                    >
                      atual
                    </span>
                  )}
                </div>
                <div className="text-[18px] font-extrabold text-slate-800 dark:text-slate-50">
                  {Number(p.value) || 0}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
