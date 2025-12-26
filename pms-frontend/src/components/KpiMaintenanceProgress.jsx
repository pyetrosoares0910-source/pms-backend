import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell } from "recharts";
import PremiumIcon from "./PremiumIcon";

export default function KpiMaintenanceProgress({ maintenanceStats, isDark }) {
    const done = maintenanceStats?.done ?? 0;
    const total = maintenanceStats?.total ?? 0;

    const pctDone = useMemo(() => {
        if (!total) return 0;
        return Math.round((done / total) * 100);
    }, [done, total]);

    const data = useMemo(
        () => [
            { name: "Concluídas", value: done },
            { name: "Pendentes", value: Math.max(0, total - done) },
        ],
        [done, total]
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="
        rounded-3xl p-6 w-full h-full border
        bg-gradient-to-br
        from-white via-slate-50 to-white
        dark:from-slate-950 dark:via-slate-900 dark:to-slate-950
        border-slate-200 dark:border-slate-700/60
        shadow-sm dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]
        transition-colors duration-300
        flex flex-col justify-center
      "
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <PremiumIcon>🛠️</PremiumIcon>
                        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                            Progresso da Manutenção
                        </h2>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        concluídas vs pendentes
                    </p>
                </div>
            </div>

            {/* centro do card */}
            <div className="mt-4 flex items-center justify-center">
                <div className="relative">
                    <PieChart width={176} height={176}>
                        <defs>
                            {/* menos neon / mais premium */}
                            <linearGradient id="maintGrad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#60a5fa" />
                                <stop offset="55%" stopColor="#7c8cff" />
                                <stop offset="100%" stopColor="#a78bfa" />
                            </linearGradient>

                            {/* glow mais suave */}
                            <filter id="maintGlow" x="-35%" y="-35%" width="170%" height="170%">
                                <feGaussianBlur stdDeviation="3" result="blur" />
                                <feMerge>
                                    <feMergeNode in="blur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>

                        <Pie
                            data={data}
                            dataKey="value"
                            innerRadius={60}
                            outerRadius={82}
                            paddingAngle={2}
                            stroke="none"
                            startAngle={90}
                            endAngle={-270}
                        >
                            {/* concluidas: gradiente com brilho reduzido */}
                            <Cell
                                fill="url(#maintGrad)"
                                filter="url(#maintGlow)"
                                fillOpacity={0.88}
                            />

                            {/* pendentes: neutro elegante */}
                            <Cell
                                fill={
                                    isDark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)"
                                }
                            />
                        </Pie>
                    </PieChart>

                    {/* Centro: % */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 leading-none">
                            {pctDone}%
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            concluído
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-3 flex items-center justify-center text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {done}
                </span>
                <span className="mx-1.5 opacity-60">/</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {total}
                </span>
                <span className="ml-2 text-slate-500 dark:text-slate-400">
                    concluídas
                </span>
            </div>
        </motion.div>
    );
}
