import { Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
import clsx from "clsx";

/**
 * =============================================================
 * ✅ ULTRA PREMIUM STATCARD — Versão Enterprise / SaaS
 * Elegante, profissional, suave e com animações de alto padrão.
 * -------------------------------------------------------------
 * Features:
 * • Entrada com animação (fade + slide + spring)
 * • Animação stagger (ativado no grid)
 * • Hover com elevação + sombra suave
 * • Shine sweep premium (diagonal, suave e elegante)
 * • Ícone com micro tilt + bounce
 * • Valor com contagem animada 0 → valor
 * • Faixa gradiente lateral de alta definição
 * • Suporte total a Link e onClick
 * • Modo sólido ou suave (tone)
 * =============================================================
 */

// =======================================================================
// ✅ Animated Number — animação premium 0 → valor com easeOut + spring
// =======================================================================
function AnimatedNumber({ value, className }) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => Math.floor(v).toLocaleString());

  useEffect(() => {
    animate(mv, Number(value) || 0, {
      duration: 1.2,
      ease: "easeOut",
    });
  }, [value]);

  return <motion.span className={className}>{display}</motion.span>;
}

// =======================================================================
// ✅ Ultra Premium StatCard
// =======================================================================
export default function StatCard({
  title,
  value,
  icon = "ℹ️",
  color = "primary",
  size = "md",
  tone = "soft",
  to,
  onClick,
  className,
}) {
  const Wrapper = to ? Link : onClick ? "button" : "div";

  // =============================================================
  // ✅ Paleta ultra premium — com destaques mais suaves e elegantes
  // =============================================================
  const palettes = {
    primary:   { bg: "bg-blue-50",    ring: "ring-blue-200",    gradFrom: "from-blue-500",    gradTo: "to-blue-600",    text: "text-blue-800",    icon: "text-blue-600",    border: "border-blue-200" },
    secondary: { bg: "bg-violet-50",  ring: "ring-violet-200",  gradFrom: "from-violet-500",  gradTo: "to-violet-600",  text: "text-violet-800",  icon: "text-violet-600",  border: "border-violet-200" },
    accent:    { bg: "bg-rose-50",    ring: "ring-rose-200",    gradFrom: "from-rose-500",    gradTo: "to-rose-600",    text: "text-rose-800",    icon: "text-rose-600",    border: "border-rose-200" },
    info:      { bg: "bg-cyan-50",    ring: "ring-cyan-200",    gradFrom: "from-cyan-500",    gradTo: "to-cyan-600",    text: "text-cyan-800",    icon: "text-cyan-600",    border: "border-cyan-200" },
    success:   { bg: "bg-emerald-50", ring: "ring-emerald-200", gradFrom: "from-emerald-500", gradTo: "to-emerald-600", text: "text-emerald-800", icon: "text-emerald-600", border: "border-emerald-200" },
    warning:   { bg: "bg-amber-50",   ring: "ring-amber-200",   gradFrom: "from-amber-500",   gradTo: "to-amber-600",   text: "text-amber-800",   icon: "text-amber-600",   border: "border-amber-200" },
    error:     { bg: "bg-red-50",     ring: "ring-red-200",     gradFrom: "from-red-500",     gradTo: "to-red-600",     text: "text-red-800",     icon: "text-red-600",     border: "border-red-200" },
  };

  const palette = palettes[color] ?? palettes.primary;

  // =============================
  // ✅ Sizes refinados
  // =============================
  const sizes = {
    sm: { pad: "p-4", title: "text-xs", value: "text-xl", icon: "text-2xl", radius: "rounded-xl" },
    md: { pad: "p-5", title: "text-sm", value: "text-2xl", icon: "text-3xl", radius: "rounded-2xl" },
    lg: { pad: "p-6", title: "text-base", value: "text-3xl", icon: "text-4xl", radius: "rounded-3xl" },
  };
  const sz = sizes[size] ?? sizes.md;

  const clickable = Boolean(to || onClick);

  const wrapperProps = {
    ...(to ? { to } : {}),
    ...(onClick ? { onClick, type: "button" } : {}),
    className: "block w-full text-left",
  };

  // =============================
  // ✅ Variants p/ animação stagger
  // =============================
  const itemVariants = {
    hidden: { opacity: 0, y: 18 },
    show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } }
  };

  // =============================
  // ✅ ROOT
  // =============================
  return (
    <Wrapper {...wrapperProps}>
      <motion.div
        variants={itemVariants}
        whileHover={ clickable ? { y: -4, scale: 1.01, boxShadow: "0 12px 32px rgba(0,0,0,0.15)" } : {} }
        whileTap={ clickable ? { scale: 0.97 } : {} }
        className={clsx(
          "group relative overflow-hidden bg-white border shadow-sm transition-all select-none backdrop-blur-sm", // leve blur
          palette.border,
          sz.radius,
          clickable && "cursor-pointer",
          className
        )}
      >
        {/* background tone */}
        <div className={clsx("absolute inset-0 opacity-70 pointer-events-none", tone === "soft" && palette.bg)} />

        {/* Faixa lateral */}
        <div className={clsx(
          "absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b pointer-events-none",
          palette.gradFrom,
          palette.gradTo
        )} />

        {/* shine diagonal */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -top-1/2 left-0 h-[200%] w-[40%] rotate-12 bg-white/25"
          initial={{ x: "-200%" }}
          whileHover={{ x: "200%" }}
          transition={{ duration: 1.1, ease: "easeInOut" }}
        />

        {/* conteúdo */}
        <div className={clsx("relative flex items-center gap-4", sz.pad)}>
          {/* Ícone */}
          <motion.div
            className={clsx(
              "flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-inner ring-1",
              palette.ring
            )}
            whileHover={ clickable ? { rotate: [-4, 4, 0], scale: 1.06 } : {} }
            transition={{ duration: 0.35 }}
          >
            <span className={clsx("select-none", sz.icon, palette.icon)}>{icon}</span>
          </motion.div>

          <div className="min-w-0">
            <div className={clsx("truncate font-medium text-neutral/70", sz.title)}>
              {title}
            </div>

            <AnimatedNumber
              value={value}
              className={clsx("truncate font-extrabold tracking-tight text-neutral", sz.value)}
            />
          </div>
        </div>

        {/* focus ring acessível */}
        {clickable && (
          <span className={clsx(
            "absolute inset-0 rounded-inherit ring-0 transition group-focus-visible:ring-2 pointer-events-none", 
            palette.ring
          )} />
        )}
      </motion.div>
    </Wrapper>
  );
}