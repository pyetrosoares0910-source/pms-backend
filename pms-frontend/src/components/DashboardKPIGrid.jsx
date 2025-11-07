import { motion } from "framer-motion";

/**
 * ====================================================================
 * ✅ ULTRA PREMIUM DASHBOARD KPI GRID
 *  - Animação Stagger (cascata)
 *  - Entrada elegante (fade + slide + ease)
 *  - Suporte total a qualquer children (StatCards, etc.)
 *  - Design limpo, responsivo e profissional
 * ====================================================================
 */

export default function DashboardKPIGrid({ children, className }) {
  return (
    <motion.div
      className={`lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 content-start ${className ?? ""}`}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: 0.08,
            delayChildren: 0.05,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * ====================================================================
 * ✅ ULTRA PREMIUM DASHBOARD KPI SKELETON
 * - Shine (shimmer) animado
 * - Responsivo
 * - Ideal para loading inicial
 * ====================================================================
 */
export function DashboardKPISkeleton() {
  const items = Array.from({ length: 10 });

  return (
    <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 content-start">
      {items.map((_, i) => (
        <div
          key={i}
          className="relative rounded-2xl border border-gray-200 bg-gray-100 shadow-sm overflow-hidden"
        >
          <div className="p-6 space-y-4 animate-pulse">
            <div className="h-4 w-32 bg-gray-200 rounded-md" />
            <div className="h-6 w-20 bg-gray-200 rounded-md" />
            <div className="h-10 w-10 bg-gray-200 rounded-xl" />
          </div>

          {/* SHIMMER */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shine" />
        </div>
      ))}
    </div>
  );
}
