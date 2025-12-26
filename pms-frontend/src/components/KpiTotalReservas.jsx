import React from "react";
import { motion } from "framer-motion";
import PremiumIcon from "./PremiumIcon";

export default function KpiTotalReservas({ value, note }) {
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
            {/* HEADER (altura “fixa” visual) */}
            <div className="min-h-[54px]">
                <div className="flex items-center gap-2">
                    <PremiumIcon>🏅</PremiumIcon>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        Total de Reservas
                    </h2>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    acumulado do histórico
                </p>
            </div>

            {/* CENTRO (alinha com o centro do gráfico) */}
            <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div
                    className="
            text-6xl font-extrabold tracking-tight leading-none
            bg-gradient-to-r from-sky-400 via-blue-500 to-violet-400
            bg-clip-text text-transparent
            drop-shadow-[0_10px_26px_rgba(59,130,246,0.14)]
          "
                >
                    {value}
                </div>

                {/* FOOTER (reserva espaço mesmo quando vazio) */}
                <div className="min-h-[22px] mt-3">
                    {note && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {note}
                        </p>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
