import { motion } from "framer-motion";
import StatCard from "./StatCard";
import PremiumIcon from "./PremiumIcon";

export default function DashboardKPIGrid({ kpis }) {
  const gridVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06, delayChildren: 0.06 } },
  };

  const sameDayPrevLabel = "Comparado ao mesmo dia do mês anterior";

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
      <StatCard
        title="Reservas ativas (hoje)"
        value={kpis.activeToday}
        prev={kpis.prev?.activeToday}
        compareLabel={sameDayPrevLabel}
        icon={<PremiumIcon>📖</PremiumIcon>}
        to="/map"
      />

      <StatCard
        title="Check-ins (hoje)"
        value={kpis.checkinsToday}
        prev={kpis.prev?.checkinsToday}
        compareLabel={sameDayPrevLabel}
        icon={<PremiumIcon>🛎️</PremiumIcon>}
        to="/map"
      />

      <StatCard
        title="Check-outs (hoje)"
        value={kpis.checkoutsToday}
        prev={kpis.prev?.checkoutsToday}
        compareLabel={sameDayPrevLabel}
        icon={<PremiumIcon>🧳</PremiumIcon>}
        to="/map"
      />

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

      <StatCard
        title="Maior ocupação"
        value={kpis.maiorOcupacao?.label ?? "-"}
        prev={kpis.prev?.maiorOcupacao}
        compareValue={kpis.compare?.maiorOcupacao}
        compareLabel={sameDayPrevLabel}
        icon={<PremiumIcon>🏆</PremiumIcon>}
        to="/performance-report"
      />

      <StatCard
        title="Média de diárias por reserva"
        value={kpis.mediaDiariasReserva}
        prev={kpis.prev?.mediaDiariasReserva}
        compareValue={kpis.compare?.mediaDiariasReserva}
        compareLabel={sameDayPrevLabel}
        icon={<PremiumIcon>📆</PremiumIcon>}
        to="/performance-report"
      />

      <StatCard
        title="Menor ocupação"
        value={kpis.menorOcupacao?.label ?? "-"}
        prev={kpis.prev?.menorOcupacao}
        compareValue={kpis.compare?.menorOcupacao}
        compareLabel={sameDayPrevLabel}
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
        compareValue={kpis.compare?.eficienciaLimpeza}
        compareLabel={sameDayPrevLabel}
        icon={<PremiumIcon>🧹</PremiumIcon>}
        to="/cleaning-schedule"
      />
    </motion.div>
  );
}
