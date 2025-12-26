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
        flex flex-col
      "
        >
            {/* HEADER */}
            <div className="min-h-[54px]">
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

            {/* CENTRO */}
            <div className="flex-1 flex flex-col items-center justify-center">
                <div className="relative">
                    {/* PieChart igual ao seu (pode manter) */}
                    {/* ... */}
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
            </div>
        </motion.div>
    );
}
