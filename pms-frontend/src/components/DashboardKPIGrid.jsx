import { Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useMemo } from "react";
import clsx from "clsx";

/**
 * =============================================================
 *  STATCARD — PREMIUM OPTION B ("Glow Azul B")
 *  Estilo minimalista, moderno e sofisticado com foco em legibilidade.
 *  - Paleta neutra com acento azul (consistente em todos os cards)
 *  - Hover com glow azul elegante (sem exageros)
 *  - Ícone discreto em medalhão translúcido
 *  - Contagem animada só para valores numéricos
 *  - Link/OnClick sem elementos bloqueando o clique
 *  - A11y: foco visível
 * =============================================================
 */

// ========= Animated Number (conta 0 → valor apenas se for número)
function AnimatedNumber({ value, className }) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => Math.floor(v).toLocaleString());

  useEffect(() => {
    const target = Number(value);
    if (Number.isFinite(target)) {
      animate(mv, target, { duration: 1.0, ease: "easeOut" });
    } else {
      mv.set(0);
    }
  }, [value]);

  return <motion.span className={className}>{display}</motion.span>;
}

export default function StatCard({
  title,
  value,
  icon = "ℹ️",
  to,
  onClick,
  className,
  size = "md", // 'sm' | 'md' | 'lg'
  subtitle,     // opcional, linha pequena abaixo do título
}) {
  const Wrapper = to ? Link : onClick ? "button" : "div";
  const isNumeric = useMemo(() => {
    if (typeof value === "number") return true;
    if (typeof value === "string" && value.trim() !== "" && !isNaN(Number(value))) return true;
    return false;
  }, [value]);

  const sizes = {
    sm: { pad: "p-4",  title: "text-[12px]", value: "text-xl",  icon: "h-9 w-9", radius: "rounded-xl" },
    md: { pad: "p-5",  title: "text-[13px]", value: "text-2xl", icon: "h-10 w-10", radius: "rounded-2xl" },
    lg: { pad: "p-6",  title: "text-sm",     value: "text-3xl", icon: "h-12 w-12", radius: "rounded-3xl" },
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
        initial={{ y: 10, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        whileHover={{ y: -3, boxShadow: "0 18px 40px rgba(37, 99, 235, 0.20)" }} // glow azul B
        whileTap={{ scale: 0.98 }}
        className={clsx(
          "group relative overflow-hidden bg-white border border-slate-200 shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-all",
          "hover:border-slate-300",
          sz.radius,
          (to || onClick) && "cursor-pointer",
          className
        )}
      >
        {/* TOP hairline gradient azul (elegante) */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 opacity-80" />

        <div className={clsx("relative flex items-center gap-4", sz.pad)}>
          {/* Medalhão do ícone, translúcido */}
          <motion.div
            className={clsx(
              "flex items-center justify-center rounded-2xl ring-1 ring-slate-200/70",
              "bg-gradient-to-b from-slate-50 to-white/60",
              sz.icon
            )}
            whileHover={{ rotate: [-2, 2, 0] }}
            transition={{ duration: 0.3 }}
          >
            <span className="text-[22px] select-none">{icon}</span>
          </motion.div>

          <div className="min-w-0">
            <div className={clsx("truncate font-medium text-slate-600", sz.title)}>{title}</div>
            {subtitle && (
              <div className="truncate text-[11px] text-slate-400 mt-0.5">{subtitle}</div>
            )}
            {isNumeric ? (
              <AnimatedNumber className={clsx("mt-1 block font-semibold tracking-tight text-slate-900", sz.value)} value={value} />
            ) : (
              <div className={clsx("mt-1 truncate font-semibold tracking-tight text-slate-900", sz.value)}>{value}</div>
            )}
          </div>
        </div>

        {/* A11y focus ring */}
        {(to || onClick) && (
          <span className="pointer-events-none absolute inset-0 rounded-inherit ring-0 transition group-focus-visible:ring-2 ring-blue-300" />
        )}
      </motion.div>
    </Wrapper>
  );
}
