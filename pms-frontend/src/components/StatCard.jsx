import { Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useMemo } from "react";
import clsx from "clsx";

/* =============================================================
   ✅ Animated Number
============================================================= */
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

/* =============================================================
   ✅ StatCard — estilo “premium clean” (base do KPI)
============================================================= */
export default function StatCard({
  title,
  value,
  prev,
  icon,
  to,
  onClick,
  className,
}) {
  const Wrapper = to ? Link : onClick ? "button" : "div";

  const isNumeric = useMemo(() => !isNaN(Number(value)), [value]);

  const prevDiff = useMemo(() => {
    if (!isNumeric || typeof prev !== "number" || isNaN(prev)) return null;
    const v = Number(value);
    return prev !== 0 ? ((v - prev) / prev) * 100 : 0;
  }, [value, prev, isNumeric]);

  const clickable = Boolean(to || onClick);

  return (
    <Wrapper {...(to ? { to } : onClick ? { onClick } : {})} className="block">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={clickable ? { y: -2 } : undefined}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={clsx(
          `
            relative rounded-3xl p-4 border
            bg-gradient-to-br
            from-white via-slate-50 to-white
            dark:from-slate-950 dark:via-slate-900 dark:to-slate-950
            border-slate-200 dark:border-slate-700/60
            shadow-sm dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)]
            transition-colors duration-300
            select-none
          `,
          clickable && "cursor-pointer",
          className
        )}
      >
        {/* Sheen sutil (premium) */}
        <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-white/55 to-white/0 dark:from-white/5 dark:to-white/0" />

        <div className="relative flex items-center gap-4">
          {/* ICON (premium tile) */}
          <motion.div
            whileHover={clickable ? { rotate: [-2, 2, 0], scale: 1.04 } : undefined}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="shrink-0"
          >
            {icon}
          </motion.div>

          {/* CONTENT */}
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-[13px] font-medium text-slate-600 truncate dark:text-slate-400">
              {title}
            </span>

            <div className="mt-0.5 flex items-center gap-2 min-w-0">
              {isNumeric ? (
                <AnimatedNumber
                  value={value}
                  className="text-[26px] font-extrabold text-slate-800 tracking-tight dark:text-slate-50"
                />
              ) : (
                <span className="text-[26px] font-extrabold text-slate-800 tracking-tight truncate dark:text-slate-50">
                  {value}
                </span>
              )}

              {/* Badge variação (mesmo “premium clean”) */}
              {isNumeric && prevDiff !== null && (
                <span
                  className={clsx(
                    `
                      px-2 py-[2px] text-xs font-semibold rounded-full
                      border shadow-sm backdrop-blur
                      whitespace-nowrap
                    `,
                    prevDiff > 0
                      ? "text-emerald-700 bg-emerald-100/35 border-emerald-300/40 dark:text-emerald-300 dark:bg-emerald-900/35 dark:border-emerald-700/60"
                      : prevDiff < 0
                        ? "text-red-600 bg-red-100/35 border-red-300/40 dark:text-red-300 dark:bg-red-900/35 dark:border-red-700/60"
                        : "text-slate-600 bg-slate-200/45 border-slate-300/40 dark:text-slate-300 dark:bg-slate-800/60 dark:border-slate-600/70"
                  )}
                >
                  {prevDiff > 0 && "▲ "}
                  {prevDiff < 0 && "▼ "}
                  {Math.abs(prevDiff).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </Wrapper>
  );
}
