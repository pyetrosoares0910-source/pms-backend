import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

const Y_MIN = 10;
const Y_MAX = 79;

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function PremiumIcon() {
  // “premium” simples e bonito (sem depender de lib)
  return (
    <span
      className="
        inline-flex items-center justify-center w-9 h-9 rounded-2xl
        bg-gradient-to-br from-sky-500/20 via-indigo-500/15 to-fuchsia-500/20
        border border-white/10 dark:border-white/10
        shadow-[0_12px_36px_rgba(56,189,248,0.18)]
      "
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2l1.4 4.6L18 8l-4.6 1.4L12 14l-1.4-4.6L6 8l4.6-1.4L12 2Z"
          stroke="currentColor"
          className="text-sky-200 dark:text-sky-200"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M19 13l.8 2.6L22 16l-2.2.4L19 19l-.8-2.6L16 16l2.2-.4L19 13Z"
          stroke="currentColor"
          className="text-indigo-200 dark:text-indigo-200"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/**
 * props:
 *  data: [{label:'OCT', value:51},{label:'NOV',value:69},{label:'DEC',value:37}]
 */
export default function KpiGaugeOcupacao({ data = [] }) {
  const points = Array.isArray(data) ? data.slice(-3) : [];
  const curIdx = Math.max(0, points.length - 1);

  const pct = Number(points?.[curIdx]?.value ?? 0) || 0;
  const pctPrev = Number(points?.[curIdx - 1]?.value ?? pct) || pct;
  const diff = pct - pctPrev;

  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null); // {idx,x,y,label,value}

  // Dimensões do SVG (bem “alto” pra evidenciar diferença)
  const dims = useMemo(
    () => ({ w: 860, h: 260, padX: 34, padTop: 26, padBottom: 44 }),
    []
  );

  const values = useMemo(
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
    return values.map((v, i) => ({
      x: xAt(i),
      y: yAt(v),
      v: Number(points[i]?.value ?? 0) || 0,
      label: points[i]?.label ?? "",
    }));
  }, [values, points]);

  // ✅ curva suave e estável (midpoints + Quadratic Bezier)
  const pathD = useMemo(() => {
    if (coords.length === 0) return "";
    if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;

    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

    const p0 = coords[0];
    let d = `M ${p0.x} ${p0.y}`;

    for (let i = 0; i < coords.length - 1; i++) {
      const pA = coords[i];
      const pB = coords[i + 1];
      const m = mid(pA, pB);

      // primeira metade: curva até o midpoint
      d += ` Q ${pA.x} ${pA.y} ${m.x} ${m.y}`;

      // última iteração: curva até o ponto final
      if (i === coords.length - 2) {
        d += ` Q ${pB.x} ${pB.y} ${pB.x} ${pB.y}`;
      }
    }
    return d;
  }, [coords]);

  const areaD = useMemo(() => {
    if (!pathD || coords.length === 0) return "";
    const baseY = dims.h - dims.padBottom;
    const first = coords[0];
    const last = coords[coords.length - 1];
    return `${pathD} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
  }, [pathD, coords]);

  const onMove = (e) => {
    if (!wrapRef.current || coords.length === 0) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, rect.width);

    const scaleX = dims.w / rect.width;
    const sx = x * scaleX;

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
    setHover({ idx: best, x: p.x, y: p.y, label: p.label, value: p.v });
  };

  const onLeave = () => setHover(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="
        w-full h-full rounded-3xl p-6 relative overflow-hidden
        border border-slate-200/60 dark:border-white/10
        bg-white dark:bg-[#0B1220]
        shadow-[0_22px_70px_rgba(2,6,23,0.10)]
        dark:shadow-[0_30px_110px_rgba(0,0,0,0.45)]
      "
    >
      {/* Premium background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="
            absolute -top-24 -left-28 w-[420px] h-[420px] rounded-full
            bg-gradient-to-br from-sky-500/25 via-indigo-500/15 to-fuchsia-500/15
            blur-3xl
          "
        />
        <div
          className="
            absolute -bottom-32 -right-32 w-[520px] h-[520px] rounded-full
            bg-gradient-to-br from-fuchsia-500/20 via-indigo-500/12 to-sky-500/18
            blur-3xl
          "
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/25 to-white/0 dark:from-white/5 dark:to-white/0" />
      </div>

      {/* Header */}
      <div className="relative flex items-start justify-between gap-4">
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
          <div className="text-[42px] font-extrabold text-slate-800 dark:text-slate-50 leading-none">
            {pct}%
          </div>
          <div
            className={`mt-1 text-[13px] font-semibold ${diff >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
              }`}
          >
            {diff >= 0 ? "▲" : "▼"} {Math.abs(diff)}%
          </div>
        </div>
      </div>

      {/* Chart container */}
      <div
        ref={wrapRef}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="
          relative mt-5 rounded-3xl overflow-hidden
          border border-slate-200/50 dark:border-white/10
          bg-white/40 dark:bg-white/5
          backdrop-blur-xl
        "
      >
        {/* subtle inner sheen */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/30 to-white/0 dark:from-white/6 dark:to-white/0" />

        <svg
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          className="relative w-full h-[250px] lg:h-[270px]"
        >
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(34,211,238,1)" />
              <stop offset="55%" stopColor="rgba(129,140,248,1)" />
              <stop offset="100%" stopColor="rgba(168,85,247,1)" />
            </linearGradient>

            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(99,102,241,0.22)" />
              <stop offset="85%" stopColor="rgba(99,102,241,0.00)" />
            </linearGradient>

            <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="7" result="b" />
              <feColorMatrix
                in="b"
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

          {/* régua vertical no hover */}
          {hover && (
            <line
              x1={hover.x}
              y1={dims.padTop - 2}
              x2={hover.x}
              y2={dims.h - dims.padBottom + 2}
              stroke="rgba(148,163,184,0.45)"
              strokeDasharray="4 7"
            />
          )}

          {/* área */}
          {areaD && <path d={areaD} fill="url(#areaGrad)" />}

          {/* linha animada */}
          <motion.path
            d={pathD}
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth="5"
            strokeLinecap="round"
            filter="url(#glow)"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.05, ease: "easeOut" }}
          />

          {/* ponto pulsante apenas no mês atual */}
          {coords[curIdx] && (
            <>
              <motion.circle
                cx={coords[curIdx].x}
                cy={coords[curIdx].y}
                r="9" // menor
                fill="rgba(129,140,248,0.18)"
                initial={{ opacity: 0.0, scale: 0.9 }}
                animate={{ opacity: [0.0, 0.75, 0.0], scale: [0.85, 1.35, 0.85] }}
                transition={{ duration: 1.55, repeat: Infinity, ease: "easeInOut" }}
              />
              <circle
                cx={coords[curIdx].x}
                cy={coords[curIdx].y}
                r="4.5"
                fill="rgba(2,6,23,0.9)"
                className="dark:fill-[#0B1220]"
              />
              <circle
                cx={coords[curIdx].x}
                cy={coords[curIdx].y}
                r="4.5"
                fill="transparent"
                stroke="rgba(186,230,253,0.95)"
                strokeWidth="2.4"
              />
            </>
          )}
        </svg>

        {/* tooltip */}
        {hover && (
          <div
            className="
              absolute top-4 right-4
              rounded-2xl px-3 py-2
              bg-white/85 dark:bg-[#0B1220]/80
              border border-slate-200/60 dark:border-white/10
              shadow-lg backdrop-blur-xl
            "
          >
            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {hover.label}
            </div>
            <div className="text-[14px] font-extrabold text-slate-800 dark:text-slate-50">
              {hover.value}%{" "}
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                (escala {Y_MIN}–{Y_MAX})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Cards compactos */}
      <div className="relative mt-4 grid grid-cols-3 gap-3">
        {points.map((p, i) => {
          const isCurrent = i === curIdx;
          return (
            <div
              key={`${p.label}-${i}`}
              className={`
                rounded-2xl px-4 py-3
                border transition-colors
                ${isCurrent
                  ? "border-sky-300/35 dark:border-indigo-300/20 bg-white/55 dark:bg-white/6"
                  : "border-slate-200/55 dark:border-white/10 bg-white/35 dark:bg-white/4"
                }
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
