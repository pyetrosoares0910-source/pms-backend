import { Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useMemo } from "react";
import clsx from "clsx";

/**
 * =============================================================
 * ✅ STATCARD — Glow Azul B (Versão Definitiva)
 * Minimalista, premium e elegante — estilo Linear/Vercel.
 * -------------------------------------------------------------
 * Features:
 * • Glow azul suave no hover
 * • Hairline azul premium no topo
 * • Ícone minimalista em medalhão translúcido
 * • Contagem animada somente para números
 * • Totalmente compatível com Link e onClick
 * • Layout clean e responsivo
 * =============================================================
 */

// =====================
// ✅ Animated Number
// =====================
function AnimatedNumber({ value, className }) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => Math.floor(v).toLocaleString());

  useEffect(() => {
    const n = Number(value);
    if (Number.isFinite(n)) {
      animate(mv, n, { duration: 1.0, ease: "easeOut" });
    } else {
      mv.set(0);
    }
  }, [value]);

  return <motion.span className={className}>{display}</motion.span>;
}

// =====================
// ✅ STATCARD PREMIUM
// =====================
export default function StatCard({
  title,
  value,
  icon = "ℹ️",
  to,
  onClick,
  className,
  size = "md", // sm | md | lg
  subtitle,
}) {
  const Wrapper = to ? Link : onClick ? "button" : "div";

  // Detecta se deve animar valor
  const isNumeric = useMemo(() => {
    const n = Number(value);
    return typeof value === "number" || (!isNaN(n) && value !== "");
  }, [value]);

  const sizes = {
    sm: { pad: "p-4", title: "text-[12px]", value: "text-xl", icon: "h-8 w-8", radius: "rounded-xl" },
    md: { pad: "p-5", title: "text-[13px]", value: "text-2xl", icon: "h-10 w-10", radius: "rounded-2xl" },
    lg: { pad: "p-6", title: "text-sm", value: "text-3xl", icon: "h-12 w-12", radius: "rounded-3xl" },
  };
  const sz = sizes[size] ?? sizes.md;

  const wrapperProps = {
    ...(to ? { to } : {}),
    ...(onClick ? { onClick, type: "button" } : {}),
    className: "block w-full text-left",
  };

  return (
    <Wrapper {...wrapperProps}>
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        whileHover={{ y: -4, boxShadow: "0 14px 32px rgba(59,130,246,0.20)" }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className={clsx(
          "relative bg-white border border-slate-200 shadow-sm transition-all overflow-visible select-none",
          "hover:border-slate-300",
          sz.radius,
          (to || onClick) && "cursor-pointer",
          className
        )}
      >
        {/* Hairline topo (Glow Azul B) */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 opacity-90 pointer-events-none" />

        {/* Conteúdo */}
        <div className={clsx("relative flex items-center gap-4", sz.pad)}>
          {/* Ícone premium */}
          <motion.div
            className={clsx(
              "flex items-center justify-center rounded-2xl ring-1 ring-slate-200/60 bg-gradient-to-b from-slate-50 to-white/70 shadow-inner",
              sz.icon
            )}
            whileHover={{ rotate: [-2, 2, 0] }}
            transition={{ duration: 0.35 }}
          >
            <span className="text-[20px] select-none">{icon}</span>
          </motion.div>

          <div className="min-w-0">
            <div className={clsx("truncate font-medium text-slate-600", sz.title)}>
              {title}
            </div>

            {subtitle && (
              <div className="truncate text-[11px] text-slate-400 mt-0.5">{subtitle}</div>
            )}

            {isNumeric ? (
              <AnimatedNumber
                value={value}
                className={clsx("mt-1 block font-semibold tracking-tight text-slate-900", sz.value)}
              />
            ) : (
              <div className={clsx("mt-1 truncate font-semibold tracking-tight text-slate-900", sz.value)}>
                {value}
              </div>
            )}
          </div>
        </div>

        {/* A11y */}
        {(to || onClick) && (
          <span className="absolute inset-0 rounded-inherit ring-0 group-focus-visible:ring-2 ring-blue-300 pointer-events-none" />
        )}
      </motion.div>
    </Wrapper>
  );
}
