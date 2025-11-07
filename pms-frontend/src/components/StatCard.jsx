import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import clsx from "clsx";

/**
 * Elegant, animated, and fully-clickable stat card
 * - to: string => wraps with <Link>
 * - onClick: () => void => clickable button
 * - color: 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error'
 * - size: 'sm' | 'md' | 'lg'
 * - tone: 'solid' | 'soft' (background style)
 */
// Animated number component
function AnimatedNumber({ value, className }) {
  const { useMotionValue, useTransform, animate } = require("framer-motion");
  const { useEffect } = require("react");

  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) => Math.floor(v).toLocaleString());

  useEffect(() => {
    animate(mv, Number(value) || 0, {
      duration: 1.4,
      ease: "easeOut",
    });
  }, [value]);

  return (
    <motion.div className={className}>
      <motion.span>{display}</motion.span>
    </motion.div>
  );
}

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

  // Tailwind needs static class names; map semantic color -> classes
  const palettes = {
    primary:   { bg: "bg-blue-50",    ring: "ring-blue-200",  gradFrom: "from-blue-500",    gradTo: "to-blue-600",    text: "text-blue-700",    icon: "text-blue-600",    border: "border-blue-200" },
    secondary: { bg: "bg-violet-50",  ring: "ring-violet-200",gradFrom: "from-violet-500",  gradTo: "to-violet-600",  text: "text-violet-700",  icon: "text-violet-600",  border: "border-violet-200" },
    accent:    { bg: "bg-rose-50",    ring: "ring-rose-200",  gradFrom: "from-rose-500",    gradTo: "to-rose-600",    text: "text-rose-700",    icon: "text-rose-600",    border: "border-rose-200" },
    info:      { bg: "bg-cyan-50",    ring: "ring-cyan-200",  gradFrom: "from-cyan-500",    gradTo: "to-cyan-600",    text: "text-cyan-700",    icon: "text-cyan-600",    border: "border-cyan-200" },
    success:   { bg: "bg-emerald-50", ring: "ring-emerald-200",gradFrom: "from-emerald-500", gradTo: "to-emerald-600", text: "text-emerald-700", icon: "text-emerald-600", border: "border-emerald-200" },
    warning:   { bg: "bg-amber-50",   ring: "ring-amber-200", gradFrom: "from-amber-500",   gradTo: "to-amber-600",   text: "text-amber-700",   icon: "text-amber-600",   border: "border-amber-200" },
    error:     { bg: "bg-red-50",     ring: "ring-red-200",   gradFrom: "from-red-500",     gradTo: "to-red-600",     text: "text-red-700",     icon: "text-red-600",     border: "border-red-200" },
  };
  const palette = palettes[color] ?? palettes.primary;

  const sizes = {
    sm: { pad: "p-4",   title: "text-xs", value: "text-xl",  icon: "text-2xl", radius: "rounded-xl" },
    md: { pad: "p-5",   title: "text-sm", value: "text-2xl", icon: "text-3xl", radius: "rounded-2xl" },
    lg: { pad: "p-6",   title: "text-sm", value: "text-3xl", icon: "text-4xl", radius: "rounded-3xl" },
  };
  const sz = sizes[size] ?? sizes.md;

  const clickable = Boolean(to || onClick);

  const wrapperProps = {
    ...(to ? { to } : {}),
    ...(onClick ? { onClick, type: "button" } : {}),
    className: "block w-full text-left",
  };

  return (
    <Wrapper {...wrapperProps}>
      <motion.div
        initial={{ y: 2, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        whileHover={ clickable ? { y: -2, boxShadow: "0 12px 24px rgba(0,0,0,0.08)" } : {} }
        whileTap={ clickable ? { scale: 0.98 } : {} }
        className={clsx(
          "group relative overflow-hidden border bg-white shadow-sm transition-all",
          palette.border,
          sz.radius,
          clickable && "cursor-pointer",
          className
        )}
      >
        {/* Subtle background tone */}
        <div className={clsx("absolute inset-0 opacity-70", tone === "soft" && palette.bg)} />

        {/* Gradient accent stripe on the left */}
        <div className={clsx("absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b", palette.gradFrom, palette.gradTo)} />

        {/* Shine sweep */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -top-1/2 left-0 h-[200%] w-1/3 rotate-12 bg-white/20"
          initial={{ x: "-150%" }}
          whileHover={{ x: "150%" }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />

        <div className={clsx("relative flex items-center gap-4", sz.pad)}>
          {/* Icon medallion */}
          <motion.div
            className={clsx(
              "flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-inner ring-1",
              palette.ring
            )}
            whileHover={ clickable ? { rotate: [-2, 2, 0] } : {} }
            transition={{ duration: 0.35 }}
          >
            <span className={clsx("select-none", sz.icon, palette.icon)}>{icon}</span>
          </motion.div>

          {/* Texts */}
          <div className="min-w-0">
            <div className={clsx("truncate font-medium text-neutral/70", sz.title)}>{title}</div>
            <AnimatedNumber value={value} className={clsx("truncate font-extrabold tracking-tight text-neutral", sz.value)} />
          </div>
        </div>

        {/* Focus ring for a11y */}
        {clickable && (
          <span className={clsx("absolute inset-0 rounded-inherit ring-0 transition group-focus-visible:ring-2", palette.ring)} />
        )}
      </motion.div>
    </Wrapper>
  );
}
