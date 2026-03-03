import { Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useMemo } from "react";
import clsx from "clsx";

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

  return <motion.span className={className}>{display}</motion.span>;
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

  const isNumeric = useMemo(
    () => !isNaN(Number(comparisonBase)),
    [comparisonBase]
  );
  const numericValue = useMemo(() => Number(comparisonBase), [comparisonBase]);

  const prevDiff = useMemo(() => {
    if (!isNumeric || typeof prev !== "number" || isNaN(prev)) return null;
    return prev !== 0 ? ((numericValue - prev) / prev) * 100 : 0;
  }, [numericValue, prev, isNumeric]);

  const clickable = Boolean(to || onClick);

  const metaLabel = useMemo(() => {
    if (!isNumeric) return "Indicador";
    if (String(value).includes(".")) return "Metrica mensal";
    return "Atualizado hoje";
  }, [isNumeric, value]);

  return (
    <Wrapper
      {...(to ? { to } : onClick ? { onClick } : {})}
      className="group block h-full"
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={clickable ? { y: -5, scale: 1.01 } : undefined}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={clsx(
          `
            relative flex h-full min-h-[154px] flex-col overflow-hidden rounded-[28px] border p-4
            bg-gradient-to-br from-white via-slate-50 to-sky-50/80
            dark:from-slate-950 dark:via-slate-900 dark:to-slate-950
            border-slate-200/80 dark:border-slate-700/60
            shadow-[0_18px_45px_rgba(15,23,42,0.08)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)]
            transition-all duration-300
            select-none
          `,
          clickable &&
          "cursor-pointer group-hover:border-sky-300/70 dark:group-hover:border-sky-500/40",
          className
        )}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-gradient-to-b from-white/70 via-white/10 to-transparent dark:from-white/5 dark:via-white/[0.03] dark:to-transparent" />
        <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-sky-400/14 blur-2xl dark:bg-sky-500/10" />
        <div className="pointer-events-none absolute -bottom-12 left-6 h-24 w-24 rounded-full bg-cyan-300/18 blur-2xl dark:bg-cyan-400/8" />

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

            <motion.div
              whileHover={clickable ? { rotate: [-4, 4, 0], scale: 1.05 } : undefined}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="shrink-0"
            >
              {icon}
            </motion.div>
          </div>

          <div className="mt-6 flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Valor atual
              </div>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                {isNumeric ? (
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

            {isNumeric && prevDiff !== null && (
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
      </motion.div>
    </Wrapper>
  );
}
