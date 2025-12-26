import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

/**
 * props:
 *  data: [{label:'OCT', value:51},{label:'NOV',value:69},{label:'DEC',value:37}]
 */
export default function KpiGaugeOcupacao({ data = [] }) {
  const points = Array.isArray(data) ? data.slice(-3) : [];
  const curIdx = Math.max(0, points.length - 1);

  const pct = clampPct(points?.[curIdx]?.value ?? 0);
  const pctPrev = clampPct(points?.[curIdx - 1]?.value ?? pct);
  const diff = pct - pctPrev;

  // ====== Y fixo (pedido): 10–79 ======
  const MIN_Y = 10;
  const MAX_Y = 79;

  // ====== SVG sizing ======
  const W = 860;
  const H = 260;
  const padX = 34;
  const padTop = 26;
  const padBottom = 44;

  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null); // {idx,x,y,label,value}

  const values = useMemo(
    () => points.map((p) => clamp(Number(p.value) || 0, MIN_Y, MAX_Y)),
    [points]
  );

  const xAt = (i) => {
    const usable = W - padX * 2;
    const step = points.length <= 1 ? 0 : usable / (points.length - 1);
    return padX + i * step;
  };

  const yAt = (v) => {
    const usable = H - padTop - padBottom;
    const t = (v - MIN_Y) / (MAX_Y - MIN_Y || 1);
    return padTop + (1 - t) * usable;
  };

  const coords = useMemo(() => {
    return values.map((v, i) => ({
      x: xAt(i),
      y: yAt(v),
      v: clampPct(points?.[i]?.value ?? 0),
      label: points?.[i]?.label ?? "",
    }));
  }, [values, points]);

  // ✅ curva suave “segura” (midpoints + Q) — sem “cotovelos”
  const pathD = useMemo(() => {
    if (coords.length === 0) return "";
    if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;

    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

    const p0 = coords[0];
    let d = `M ${p0.x} ${p0.y}`;

    for (let i = 0; i < coords.length - 1; i++) {
      const a = coords[i];
      const b = coords[i + 1];
      const m = mid(a, b);

      d += ` Q ${a.x} ${a.y} ${m.x} ${m.y}`;

      if (i === coords.length - 2) {
        d += ` Q ${b.x} ${b.y} ${b.x} ${b.y}`;
      }
    }
    return d;
  }, [coords]);

  const areaD = useMemo(() => {
    if (!pathD || coords.length === 0) return "";
    const baseY = H - padBottom + 6;
    const first = coords[0];
    const last = coords[coords.length - 1];
    return `${pathD} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
  }, [pathD, coords]);

  const onMove = (e) => {
    if (!wrapRef.current || coords.length === 0) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, rect.width);

    const scaleX = W / rect.width;
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

  const activePoint = coords[curIdx];

  // cor do “acento” (mantém sua lógica de intensidade)
  const accent =
    pct >= 80
      ? "#0ea5e9"
      : pct >= 60
        ? "#38bdf8"
        : pct >= 40
          ? "#60a5fa"
          : "#93c5fd";

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
        <div className="flex items-start gap-3">
          {/* Ícone premium (sem “emoji”) */}
          <span
            className="
              inline-flex items-center justify-center w-9 h-9 rounded-2xl
              bg-gradient-to-br from-sky-500/15 via-indigo-500/10 to-fuchsia-500/10
              border border-slate-200/60 dark:border-white/10
              shadow-[0_12px_28px_rgba(59,130,246,0.15)]
            "
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2l1.4 4.6L18 8l-4.6 1.4L12 14l-1.4-4.6L6 8l4.6-1.4L12 2Z"
                stroke="currentColor"
                className="text-slate-700 dark:text-slate-200"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M19 13l.8 2.6L22 16l-2.2.4L19 19l-.8-2.6L16 16l2.2-.4L19 13Z"
                stroke="currentColor"
                className="text-slate-700 dark:text-slate-200"
                strokeWidth="1.7"
                strokeLinejoin="round"
                opacity="0.75"
              />
            </svg>
          </span>

          <div>
            <div className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Ocupação Geral do Mês
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              comparação com o mês anterior
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-4xl font-extrabold text-slate-800 dark:text-slate-50 leading-none">
            {pct}%
          </div>
          <div
            className={`mt-1 text-sm font-semibold ${diff >= 0 ? "text-emerald-500" : "text-red-500"
              }`}
          >
            {diff >= 0 ? "▲" : "▼"} {Math.abs(diff)}%
          </div>
        </div>
      </div>

      {/* ===== Chart (separado do fundo do card) ===== */}
      <div
        ref={wrapRef}
        className="
          mt-4 relative select-none
          rounded-3xl overflow-hidden border
          border-slate-200/70 dark:border-slate-700/60
          bg-white dark:bg-slate-900/40
        "
        onMouseMove={onMove}
        onMouseEnter={onMove}
        onMouseLeave={onLeave}
      >
        {/* sheen clean */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/55 to-white/0 dark:from-white/5 dark:to-white/0" />

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="relative w-full h-[220px] lg:h-[240px]"
          role="img"
          aria-label="Ocupação (últimos 3 meses)"
        >
          <defs>
            <linearGradient id="kpiLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="55%" stopColor={accent} />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>

            <linearGradient id="kpiArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
            </linearGradient>

            <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* baseline */}
          <line
            x1={padX}
            y1={H - padBottom + 6}
            x2={W - padX}
            y2={H - padBottom + 6}
            stroke="rgba(100,116,139,0.22)"
            strokeWidth="1"
          />

          {/* régua vertical no hover */}
          {hover && (
            <line
              x1={hover.x}
              y1={padTop - 4}
              x2={hover.x}
              y2={H - padBottom + 6}
              stroke="rgba(148,163,184,0.35)"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
          )}

          {/* área */}
          {areaD && <path d={areaD} fill="url(#kpiArea)" />}

          {/* glow line */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#kpiLine)"
            strokeWidth="6"
            strokeLinecap="round"
            filter="url(#softGlow)"
            opacity="0.22"
          />

          {/* main line */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#kpiLine)"
            strokeWidth="3.2"
            strokeLinecap="round"
          />

          {/* ❗️SEM pontos nos meses anteriores — só o “pulsante” no atual */}
          {activePoint && (
            <>
              {/* halo pulse menor */}
              <motion.circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="8"
                fill="none"
                stroke={accent}
                strokeWidth="2"
                initial={{ opacity: 0.55, scale: 0.9 }}
                animate={{
                  opacity: [0.55, 0.12, 0.55],
                  r: [8, 15, 8],
                }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              />
              {/* miolo */}
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="4"
                fill="white"
                className="dark:fill-slate-950"
                opacity="0.95"
              />
              {/* anel */}
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="7"
                fill="none"
                stroke={accent}
                strokeWidth="2.2"
                opacity="0.95"
              />
            </>
          )}
        </svg>

        {/* Tooltip (HTML) */}
        {hover && (
          <div
            className="
              absolute top-3
              px-3 py-2 rounded-xl border
              bg-white/95 dark:bg-slate-950/90
              border-slate-200 dark:border-slate-700
              shadow-md backdrop-blur
              text-xs text-slate-700 dark:text-slate-100
              pointer-events-none whitespace-nowrap
            "
            style={{
              left: `${(hover.x / W) * 100}%`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {hover.label}
            </div>
            <div className="mt-0.5">
              <span className="font-semibold">{hover.value}%</span>{" "}
              <span className="text-slate-500 dark:text-slate-400">
                (escala {MIN_Y}–{MAX_Y})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* mini-cards compactos */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        {points.map((p, i) => {
          const isCurrent = i === curIdx;
          return (
            <div
              key={`${p.label}-${i}`}
              className={`
                flex items-center justify-between
                px-4 py-3 rounded-2xl border
                ${isCurrent
                  ? "border-slate-400/60 bg-slate-50 dark:bg-slate-950"
                  : "border-slate-200 bg-white dark:bg-slate-900/40 dark:border-slate-700/60"
                }
                transition-colors
              `}
            >
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-wider text-xs text-slate-500 dark:text-slate-400">
                  {p.label}
                </span>
                {isCurrent && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200">
                    atual
                  </span>
                )}
              </div>
              <div className="text-lg font-extrabold text-slate-800 dark:text-slate-50">
                {clampPct(p.value)}%
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* utils */
function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
