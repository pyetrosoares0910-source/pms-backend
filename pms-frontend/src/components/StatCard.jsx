import { Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useMemo } from "react";
import clsx from "clsx";

const MotionDiv = motion.div;
const MotionSpan = motion.span;

function AnimatedNumber({ value, className }) {
  const mv = useMotionValue(0);

  const display = useTransform(mv, (v) => {
    if (String(value).includes(".")) return v.toFixed(1);
    return Math.round(v).toLocaleString("pt-BR");
  });

  useEffect(() => {
    const num = Number(value);
    if (!isNaN(num)) {
      const controls = animate(mv, num, { duration: 1, ease: "easeOut" });
      return () => controls?.stop?.();
    }
  }, [value, mv]);

  return <MotionSpan className={className}>{display}</MotionSpan>;
}

export default function StatCard({
  title,
  value,
  prev,
  compareValue,
  compareLabel,
  icon,
  to,
  onClick,
  className,
}) {
  const Wrapper = to ? Link : onClick ? "button" : "div";

  const comparisonBase = compareValue ?? value;

  const isDisplayNumeric = useMemo(() => !isNaN(Number(value)), [value]);
  const isComparisonNumeric = useMemo(
    () => !isNaN(Number(comparisonBase)),
    [comparisonBase]
  );
  const numericValue = useMemo(() => Number(comparisonBase), [comparisonBase]);

  const prevDiff = useMemo(() => {
    if (!isComparisonNumeric || typeof prev !== "number" || isNaN(prev)) return null;
    return prev !== 0 ? ((numericValue - prev) / prev) * 100 : 0;
  }, [numericValue, prev, isComparisonNumeric]);

  const clickable = Boolean(to || onClick);

  const metaLabel = useMemo(() => {
    if (!isDisplayNumeric) return "Indicador";
    if (String(value).includes(".")) return "Metrica mensal";
    return "Atualizado hoje";
  }, [isDisplayNumeric, value]);

  return (
    <Wrapper
      {...(to ? { to } : onClick ? { onClick } : {})}
      className="group block h-full"
    >
      <MotionDiv
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={clickable ? { y: -5, scale: 1.01 } : undefined}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={clsx(
          `
            app-card
            relative flex h-full min-h-[154px] flex-col overflow-hidden p-4
            transition-all duration-300
            select-none
          `,
          clickable &&
          "cursor-pointer group-hover:border-sky-300/70 dark:group-hover:border-sky-500/40",
          className
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/60 to-transparent dark:via-sky-400/30" />
        <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-sky-400/10 blur-2xl dark:bg-sky-500/8" />

        <div className="relative flex h-full flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center rounded-full border border-white/70 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                {metaLabel}
              </span>
              <p className="mt-3 max-w-[16ch] text-sm font-semibold leading-5 text-slate-700 dark:text-slate-300">
                {title}
              </p>
            </div>

            <MotionDiv
              whileHover={clickable ? { rotate: [-4, 4, 0], scale: 1.05 } : undefined}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="shrink-0"
            >
              {icon}
            </MotionDiv>
          </div>

          <div className="mt-6 flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Valor atual
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                {isDisplayNumeric ? (
                  <AnimatedNumber
                    value={value}
                    className="text-[32px] font-black leading-none tracking-[-0.04em] text-slate-900 dark:text-slate-50"
                  />
                ) : (
                  <span className="truncate text-[30px] font-black leading-none tracking-[-0.04em] text-slate-900 dark:text-slate-50">
                    {value}
                  </span>
                )}
              </div>
            </div>

            {isComparisonNumeric && prevDiff !== null && (
              <span
                className={clsx(
                  `
                    inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5
                    text-xs font-semibold shadow-sm backdrop-blur whitespace-nowrap
                  `,
                  prevDiff > 0
                    ? "text-emerald-700 bg-emerald-100/65 border-emerald-300/50 dark:text-emerald-300 dark:bg-emerald-900/35 dark:border-emerald-700/60"
                    : prevDiff < 0
                      ? "text-rose-700 bg-rose-100/70 border-rose-300/50 dark:text-rose-300 dark:bg-rose-900/35 dark:border-rose-700/60"
                      : "text-slate-600 bg-slate-200/70 border-slate-300/50 dark:text-slate-300 dark:bg-slate-800/60 dark:border-slate-600/70"
                )}
              >
                <span className="text-[10px]">
                  {prevDiff > 0 ? "+" : prevDiff < 0 ? "-" : "="}
                </span>
                {Math.abs(prevDiff).toFixed(1)}%
              </span>
            )}
          </div>

          <div className="mt-auto pt-5">
            <div className="h-px bg-gradient-to-r from-transparent via-slate-200/90 to-transparent dark:via-slate-700/60" />
            <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span>
                {prevDiff === null
                  ? "Sem comparativo"
                  : compareLabel || "Comparado ao periodo anterior"}
              </span>
              {clickable && (
                <span className="rounded-full border border-slate-200/80 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 transition-colors group-hover:text-sky-700 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-300 dark:group-hover:text-sky-300">
                  Ver detalhe
                </span>
              )}
            </div>
          </div>
        </div>
      </MotionDiv>
    </Wrapper>
  );
}
