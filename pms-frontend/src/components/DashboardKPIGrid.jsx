import { motion } from "framer-motion";
import StatCard from "./StatCard";

export default function DashboardKPIGrid({ kpis }) {
  const gridVariants = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.07, delayChildren: 0.1 },
    },
  };

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 lg:col-span-2"
      initial="hidden"
      animate="show"
      variants={gridVariants}
    >
      <StatCard title="Reservas ativas (hoje)" value={kpis.activeToday} icon="📖" to="/map" />
      <StatCard title="Check-ins (hoje)" value={kpis.checkinsToday} icon="🛎️" to="/map" />
      <StatCard title="Check-outs (hoje)" value={kpis.checkoutsToday} icon="🧳" to="/map" />
      <StatCard title="Diárias no mês" value={kpis.nightsInMonth} icon="🗓️" to="/map" />
      <StatCard title="Reservas no mês" value={kpis.reservasMes} icon="🧾" to="/map" />

      <StatCard title="Maior ocupação" value={kpis.maiorOcupacao?.label ?? "-"} icon="🏆" to="/performance-report" />
      <StatCard title="Média de diárias por reserva" value={kpis.mediaDiariasReserva} icon="📆" to="/performance-report" />
      <StatCard title="Menor ocupação" value={kpis.menorOcupacao?.label ?? "-"} icon="⚠️" to="/performance-report" />

      <StatCard title="Diárias de limpeza" value={kpis.diariasLimpeza} icon="🪣" to="/cleaning-schedule" />
      <StatCard title="Eficiência de limpeza" value={kpis.eficienciaLimpeza} icon="🧹" to="/cleaning-schedule" />
    </motion.div>
  );
}
