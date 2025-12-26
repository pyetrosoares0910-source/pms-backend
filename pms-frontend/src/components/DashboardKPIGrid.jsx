import { motion } from "framer-motion";
import StatCard from "./StatCard";
import PremiumIcon from "./PremiumIcon";

export default function DashboardKPIGrid({ kpis }) {
  const gridVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06, delayChildren: 0.06 } },
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={gridVariants}
      className="
        w-full
        grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5
        gap-4 lg:gap-5
        auto-rows-fr
      "
    >
      {/* ✅ KPIs do dia — SEM comparativo */}
      <StatCard
        title="Reservas ativas (hoje)"
        value={kpis.activeToday}
        icon={<PremiumIcon>📖</PremiumIcon>}
        to="/map"
      />

      <StatCard
        title="Check-ins (hoje)"
        value={kpis.checkinsToday}
        icon={<PremiumIcon>🛎️</PremiumIcon>}
        to="/map"
      />

      <StatCard
        title="Check-outs (hoje)"
        value={kpis.checkoutsToday}
        icon={<PremiumIcon>🧳</PremiumIcon>}
        to="/map"
      />

      {/* ✅ KPIs Mensais — COM comparativo */}
      <StatCard
        title="Diárias no mês"
        value={kpis.nightsInMonth}
        prev={kpis.prev?.nightsInMonth}
        icon={<PremiumIcon>🗓️</PremiumIcon>}
        to="/map"
      />

      <StatCard
        title="Reservas no mês"
        value={kpis.reservasMes}
        prev={kpis.prev?.reservasMes}
        icon={<PremiumIcon>🧾</PremiumIcon>}
        to="/map"
      />

      {/* ✅ KPIs com string — SEM comparativo */}
      <StatCard
        title="Maior ocupação"
        value={kpis.maiorOcupacao?.label ?? "-"}
        icon={<PremiumIcon>🏆</PremiumIcon>}
        to="/performance-report"
      />

      <StatCard
        title="Média de diárias por reserva"
        value={kpis.mediaDiariasReserva}
        prev={kpis.prev?.mediaDiariasReserva}
        icon={<PremiumIcon>📆</PremiumIcon>}
        to="/performance-report"
      />

      <StatCard
        title="Menor ocupação"
        value={kpis.menorOcupacao?.label ?? "-"}
        icon={<PremiumIcon>⚠️</PremiumIcon>}
        to="/performance-report"
      />

      <StatCard
        title="Diárias de limpeza"
        value={kpis.diariasLimpeza}
        prev={kpis.prev?.diariasLimpeza}
        icon={<PremiumIcon>🪣</PremiumIcon>}
        to="/cleaning-schedule"
      />

      <StatCard
        title="Eficiência de limpeza"
        value={kpis.eficienciaLimpeza}
        prev={kpis.prev?.eficienciaLimpeza}
        icon={<PremiumIcon>🧹</PremiumIcon>}
        to="/cleaning-schedule"
      />
    </motion.div>
  );
}
