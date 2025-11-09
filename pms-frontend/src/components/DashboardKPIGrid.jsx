import { motion } from "framer-motion";
import StatCard from "./StatCard";

export default function DashboardKPIGrid({ kpis }) {
  const gridVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
  };

  return (
    <motion.div
  className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6"
  initial="hidden"
  animate="show"
  variants={gridVariants}
>


      {/* ✅ KPIs do dia — SEM comparativo */}
      <StatCard
        title="Reservas ativas (hoje)"
        value={kpis.activeToday}
        icon="📖"
        to="/map"
      />

      <StatCard
        title="Check-ins (hoje)"
        value={kpis.checkinsToday}
        icon="🛎️"
        to="/map"
      />

      <StatCard
        title="Check-outs (hoje)"
        value={kpis.checkoutsToday}
        icon="🧳"
        to="/map"
      />

      {/* ✅ KPIs Mensais — COM comparativo */}
      <StatCard
        title="Diárias no mês"
        value={kpis.nightsInMonth}
        prev={kpis.prev?.nightsInMonth}
        icon="🗓️"
        to="/map"
      />

      <StatCard
        title="Reservas no mês"
        value={kpis.reservasMes}
        prev={kpis.prev?.reservasMes}
        icon="🧾"
        to="/map"
      />

      {/* ✅ KPIs com string — SEM comparativo */}
      <StatCard
        title="Maior ocupação"
        value={kpis.maiorOcupacao?.label ?? "-"}
        icon="🏆"
        to="/performance-report"
      />

      <StatCard
        title="Média de diárias por reserva"
        value={kpis.mediaDiariasReserva}
        prev={kpis.prev?.mediaDiariasReserva}
        icon="📆"
        to="/performance-report"
      />

      <StatCard
        title="Menor ocupação"
        value={kpis.menorOcupacao?.label ?? "-"}
        icon="⚠️"
        to="/performance-report"
      />

      <StatCard
        title="Diárias de limpeza"
        value={kpis.diariasLimpeza}
        prev={kpis.prev?.diariasLimpeza}
        icon="🪣"
        to="/cleaning-schedule"
      />

      <StatCard
        title="Eficiência de limpeza"
        value={kpis.eficienciaLimpeza}
        prev={kpis.prev?.eficienciaLimpeza}
        icon="🧹"
        to="/cleaning-schedule"
      />
    </motion.div>
  );
}
