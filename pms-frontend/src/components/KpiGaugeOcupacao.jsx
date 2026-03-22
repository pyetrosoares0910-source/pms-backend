import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

const RANGE_OPTIONS = [3, 6, 12];

/**
 * props:
 *  data: [{label:'OCT', fullLabel:'October 2025', value:51}]
 */
export default function KpiGaugeOcupacao({ data = [] }) {
  const MotionDiv = motion.div;
  const MotionCircle = motion.circle;
  const [selectedRange, setSelectedRange] = useState(3);
  const allPoints = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const activeRange = Math.min(selectedRange, allPoints.length || selectedRange);
  const points = useMemo(
    () => allPoints.slice(-activeRange),
    [activeRange, allPoints]
  );
  const curIdx = Math.max(0, points.length - 1);

  const pct = clampPct(points?.[curIdx]?.value ?? 0);
  const pctPrev = clampPct(points?.[curIdx - 1]?.value ?? pct);
  const diff = pct - pctPrev;

  // ====== SVG sizing ======
  const W = 860;
  const H = 260;
  const padX = 34;
  const padTop = 26;
  const padBottom = 44;

  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null); // {idx,x,y,label,value}

  const { minScale, maxScale } = useMemo(() => {
    const rawValues = points.map((point) => clampPct(point?.value ?? 0));

    if (rawValues.length === 0) {
      return { minScale: 0, maxScale: 100 };
    }

    const minValue = Math.min(...rawValues);
    const maxValue = Math.max(...rawValues);
    const padding = Math.max(6, Math.ceil((maxValue - minValue || 12) * 0.25));

    let nextMin = Math.max(0, minValue - padding);
    let nextMax = Math.min(100, maxValue + padding);

    if (nextMax - nextMin < 20) {
      const midpoint = (nextMin + nextMax) / 2;
      nextMin = Math.max(0, Math.floor(midpoint - 10));
      nextMax = Math.min(100, Math.ceil(midpoint + 10));
    }

    return { minScale: nextMin, maxScale: nextMax };
  }, [points]);

  const values = useMemo(
    () => points.map((p) => clamp(Number(p.value) || 0, minScale, maxScale)),
    [maxScale, minScale, points]
  );

  const coords = useMemo(() => {
    const usableWidth = W - padX * 2;
    const usableHeight = H - padTop - padBottom;
    const step = points.length <= 1 ? 0 : usableWidth / (points.length - 1);

    return values.map((v, i) => ({
      x: padX + i * step,
      y:
        padTop +
        (1 - (v - minScale) / (maxScale - minScale || 1)) * usableHeight,
      v: clampPct(points?.[i]?.value ?? 0),
      label: points?.[i]?.label ?? "",
      fullLabel: points?.[i]?.fullLabel ?? points?.[i]?.label ?? "",
    }));
  }, [H, W, maxScale, minScale, padBottom, padTop, padX, points, values]);

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
    setHover({
      idx: best,
      x: p.x,
      y: p.y,
      label: p.label,
      fullLabel: p.fullLabel,
      value: p.v,
    });
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
    <MotionDiv
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
      <div className="flex flex-wrap items-start justify-between gap-4">
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
              exibindo os últimos {activeRange} meses
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-col items-end gap-3">
          <div className="inline-flex rounded-2xl border border-slate-200/80 bg-slate-100/80 p-1 dark:border-slate-700/60 dark:bg-slate-900/80">
            {RANGE_OPTIONS.map((option) => {
              const isActive = option === selectedRange;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSelectedRange(option)}
                  aria-pressed={isActive}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${isActive
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    }`}
                >
                  {option}M
                </button>
              );
            })}
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
          aria-label={`Ocupação dos últimos ${activeRange} meses`}
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
              <MotionCircle
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
            <div className="font-semibold tracking-wide text-slate-500 dark:text-slate-400">
              {hover.fullLabel}
            </div>
            <div className="mt-0.5 font-semibold">{hover.value}%</div>
          </div>
        )}
      </div>

      {/* mini-cards compactos */}
      <div className="mt-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {points.map((p, i) => {
          const isCurrent = i === curIdx;
          return (
            <div
              key={`${p.label}-${i}`}
              className={`
                relative overflow-hidden
                flex min-h-[92px] flex-col justify-between
                rounded-[22px] border px-4 py-3
                ${isCurrent
                  ? "border-sky-400/45 bg-[linear-gradient(180deg,_rgba(56,189,248,0.10),_rgba(255,255,255,0.98)_45%)] shadow-[0_10px_24px_rgba(56,189,248,0.10)] dark:border-sky-400/40 dark:bg-[linear-gradient(180deg,_rgba(56,189,248,0.14),_rgba(15,23,42,0.96)_46%)]"
                  : "border-slate-200/90 bg-white/95 dark:bg-slate-900/40 dark:border-slate-700/60"
                }
                transition-all duration-200
              `}
            >
              <div className="space-y-2">
                <div className="inline-flex min-w-0 items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${isCurrent
                        ? "bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.8)]"
                        : "bg-slate-300 dark:bg-slate-600"
                      }`}
                  />
                  <span className="uppercase tracking-[0.22em] text-[11px] text-slate-500 dark:text-slate-400">
                    {p.label}
                  </span>
                </div>
                {isCurrent && (
                  <span className="inline-flex self-start rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-sky-700 dark:border-sky-400/25 dark:bg-sky-500/15 dark:text-sky-200">
                    atual
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-end justify-between gap-3">
                <div className="text-[22px] font-black leading-none tracking-tight text-slate-800 dark:text-slate-50 md:text-[24px]">
                  {clampPct(p.value)}%
                </div>
                <div
                  className={`mb-1 h-1.5 w-8 shrink-0 rounded-full ${isCurrent
                      ? "bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.45)]"
                      : "bg-slate-200 dark:bg-slate-700"
                    }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </MotionDiv>
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
