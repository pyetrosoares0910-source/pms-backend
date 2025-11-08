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
      animate(mv, num, { duration: 1, ease: "easeOut" });
    }
  }, [value]);

  return <motion.span className={className}>{display}</motion.span>;
}

/* =============================================================
   ✅ StatCard Glow Azul B — COM VARIAÇÃO (C3)
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

  /* ✅ Calcula variação (C3) */
  const prevDiff = useMemo(() => {
    if (!isNumeric || typeof prev !== "number" || isNaN(prev)) return null;
    const v = Number(value);
    return prev !== 0 ? ((v - prev) / prev) * 100 : 0;
  }, [value, prev, isNumeric]);

  return (
    <Wrapper {...(to ? { to } : onClick ? { onClick } : {})} className="block">

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{
          y: -3,
          boxShadow: "0 16px 40px rgba(56, 132, 255, 0.18)",
        }}
        transition={{ duration: 0.25 }}
        className={clsx(
          "relative bg-white border border-slate-200 rounded-2xl shadow-sm",
          "p-4 flex items-center gap-4",
          "transition-all select-none",
          (to || onClick) && "cursor-pointer",
          className
        )}
      >

        {/* === LINHA SUPERIOR CURVADA === */}
        <div
          className="absolute top-0 left-2 right-2 h-[4px] rounded-md
          bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 opacity-90 pointer-events-none"
        />

        {/* === ICON === */}
        <motion.div
          whileHover={{ rotate: [-3, 3, 0], scale: 1.06 }}
          transition={{ duration: 0.35 }}
          className="h-11 w-11 flex items-center justify-center 
          rounded-xl bg-gradient-to-b from-slate-50 to-white/70 
          ring-1 ring-slate-200 text-[22px]"
        >
          {icon}
        </motion.div>

        {/* === CONTENT === */}
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-medium text-slate-600 truncate">
            {title}
          </span>

          <div className="flex items-center gap-2">
            {isNumeric ? (
              <AnimatedNumber
                value={value}
                className="text-[26px] font-bold text-slate-900 tracking-tight"
              />
            ) : (
              <span className="text-[26px] font-bold text-slate-900 tracking-tight truncate">
                {value}
              </span>
            )}

            {/* ✅ Badge Premium (C3) */}
            {isNumeric && prevDiff !== null && (
              <span
                className={clsx(
                  "px-2 py-[2px] text-xs font-semibold rounded-full",
                  "backdrop-blur-md border shadow-md",
                  prevDiff > 0
                    ? "text-emerald-700 bg-emerald-100/30 border-emerald-300/40 shadow-emerald-400/40"
                    : prevDiff < 0
                    ? "text-red-600 bg-red-100/30 border-red-300/40 shadow-red-400/40"
                    : "text-slate-500 bg-slate-200/40 border-slate-300/40"
                )}
              >
                {prevDiff > 0 && "▲ "}
                {prevDiff < 0 && "▼ "}
                {Math.abs(prevDiff).toFixed(1)}%
              </span>
            )}
          </div>
        </div>

      </motion.div>
    </Wrapper>
  );
}
