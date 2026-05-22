import React from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import PremiumIcon from "./PremiumIcon";

const MotionDiv = motion.div;

export default function KpiTotalReservas({ value, note }) {
  return (
    <MotionDiv
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="app-card relative flex h-full w-full flex-col overflow-hidden p-5"
    >
      <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-cyan-400/10 blur-3xl dark:bg-cyan-500/10" />

      <div className="relative flex items-start gap-2">
        <div className="flex items-center gap-2">
          <PremiumIcon>
            <Trophy size={22} strokeWidth={2.4} />
          </PremiumIcon>
        </div>
        <div className="pt-1">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Total de Reservas
          </h2>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            acumulado do historico
          </p>
        </div>
      </div>

      <div className="relative mt-auto flex flex-col justify-end pt-5 text-center">
        <div className="bg-gradient-to-r from-sky-400 via-blue-500 to-violet-400 bg-clip-text text-5xl font-black leading-none tracking-tight text-transparent drop-shadow-[0_10px_26px_rgba(59,130,246,0.14)]">
          {value}
        </div>

        <div className="min-h-[22px] mt-3">
          {note && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {note}
            </p>
          )}
        </div>
      </div>
    </MotionDiv>
  );
}
