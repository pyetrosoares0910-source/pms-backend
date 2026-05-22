import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Wrench } from "lucide-react";
import PremiumIcon from "./PremiumIcon";

const MotionDiv = motion.div;

export default function KpiMaintenanceProgress({ maintenanceStats }) {
  const done = maintenanceStats?.done ?? 0;
  const total = maintenanceStats?.total ?? 0;
  const pending = Math.max(0, total - done);

  const pctDone = useMemo(() => {
    if (!total) return 0;
    return Math.round((done / total) * 100);
  }, [done, total]);

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="app-card relative flex h-full w-full flex-col overflow-hidden p-5"
    >
      <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-sky-400/10 blur-3xl dark:bg-sky-500/10" />

      <div className="relative">
        <div className="flex items-center gap-2">
          <PremiumIcon>
            <Wrench size={22} strokeWidth={2.4} />
          </PremiumIcon>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Progresso da Manutencao
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          linha de conclusao das atividades
        </p>
      </div>

      <div className="relative mt-auto flex flex-col justify-end gap-4 pt-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Conclusao
            </div>
            <div className="mt-1 text-4xl font-black tracking-tight text-slate-950 dark:text-slate-50">
              {pctDone}%
            </div>
          </div>
          <div className="text-right text-sm text-slate-500 dark:text-slate-400">
            <span className="font-bold text-slate-900 dark:text-slate-100">{done}</span>
            <span className="mx-1 opacity-60">/</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{total}</span>
            <div className="text-xs">concluidas</div>
          </div>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-800">
          <MotionDiv
            initial={{ width: 0 }}
            animate={{ width: `${pctDone}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-cyan-300 shadow-[0_0_18px_rgba(14,165,233,0.35)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/35 dark:text-emerald-200">
            <div className="font-black">{done}</div>
            <div className="font-semibold">Concluidas</div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/35 dark:text-amber-200">
            <div className="font-black">{pending}</div>
            <div className="font-semibold">Pendentes</div>
          </div>
        </div>
      </div>
    </MotionDiv>
  );
}
