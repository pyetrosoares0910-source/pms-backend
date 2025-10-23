import React, { useState, useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Map,
  Brush,
  Wrench,
  Users,
  Puzzle,
  Filetext,
  UsersRound,
  Building,
  Bed,
  UserCog,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LogOut,
  BarChart3, // ícone do relatório de desempenho
} from "lucide-react";

// ======================= COMPONENTE ITEM =======================
const Item = ({ to, children, icon: Icon, showText, collapsed, highlight }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-300 ease-out 
      ${isActive
        ? highlight
          ? "bg-indigo-500/20 text-indigo-200 font-semibold border-l-4 border-indigo-400"
          : "bg-white/15 text-white font-semibold border-l-4 border-blue-400"
        : highlight
          ? "text-indigo-300 hover:bg-indigo-500/10 hover:text-indigo-200"
          : "text-gray-200 hover:bg-white/10 hover:text-white"
      }`
    }
  >
    {Icon && (
      <Icon
        size={18}
        className={`transition-all duration-300 ease-out ${
          showText
            ? "opacity-0 animate-fade-in-blur-slow"
            : "opacity-0 animate-fade-in-blur"
        } ${highlight ? "text-indigo-300 group-hover:text-indigo-200" : ""}`}
      />
    )}

    {showText && (
      <span
        className={`text-sm opacity-0 animate-fade-in-blur-slow ${
          highlight ? "text-indigo-200 font-medium" : ""
        }`}
      >
        {children}
      </span>
    )}
  </NavLink>
);

// ======================= DASHBOARD LAYOUT =======================
export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [showText, setShowText] = useState(!collapsed);

  // Sincroniza texto com expansão/recolhimento
  useEffect(() => {
    if (!collapsed) {
      const timer = setTimeout(() => setShowText(true), 380);
      return () => clearTimeout(timer);
    } else {
      setShowText(false);
    }
  }, [collapsed]);

  const toggleSidebar = () => {
    localStorage.setItem("sidebar-collapsed", !collapsed);
    setCollapsed(!collapsed);
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* SIDEBAR */}
      <aside
        className={`bg-gradient-to-b from-sky-900 to-sky-950 text-white flex flex-col shadow-lg transition-[width] duration-400 ease-out overflow-hidden ${
          collapsed ? "w-[72px]" : "w-[240px]"
        }`}
      >
        {/* TOPO */}
        <div className="p-4 border-b border-white/10 flex items-center justify-center shrink-0">
          {collapsed ? (
            <Building
              size={26}
              className="text-white transition-transform duration-300 ease-out"
            />
          ) : (
            showText && (
              <div className="text-xl font-bold tracking-wide opacity-0 animate-fade-in-blur">
                PMS
              </div>
            )
          )}
        </div>

        {/* USUÁRIO */}
        {user && showText && (
          <div className="px-4 py-2 text-sm text-gray-200 border-b border-white/10 opacity-0 animate-fade-in-blur">
            👋 Olá, <span className="font-medium">{user.name}</span>
          </div>
        )}

        {/* NAVEGAÇÃO */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
          <Item to="/dashboard" icon={LayoutDashboard} showText={showText}>
            Dashboard
          </Item>
          <Item to="/map" icon={Map} showText={showText}>
            Mapa de Reservas
          </Item>
          <Item to="/cleaning-schedule" icon={Puzzle} showText={showText}>
            Controle Limpeza
          </Item>
          <Item
            to="/maintenance-calendar"
            icon={CalendarDays}
            showText={showText}
          >
            Agenda de Atividades
          </Item>

          {showText && (
            <div className="mt-5 mb-1 text-xs font-semibold uppercase opacity-60 tracking-wider opacity-0 animate-fade-in-blur-slower">
              Cadastros
            </div>
          )}
          <Item to="/reservations" icon={Filetext} showText={showText}>
            Reservas
          </Item>
          <Item to="/guests" icon={Users} showText={showText}>
            Hóspedes
          </Item>
          <Item to="/stays" icon={Building} showText={showText}>
            Empreendimentos
          </Item>
          <Item to="/rooms" icon={Bed} showText={showText}>
            Quartos
          </Item>
          <Item to="/staff" icon={UserCog} showText={showText}>
            Funcionários
          </Item>
          <Item to="/maids" icon={UsersRound} showText={showText}>
            Diaristas
          </Item>
          <Item to="/maintenance" icon={Wrench} showText={showText}>
            Atividades
          </Item>

          {showText && (
            <div className="mt-5 mb-1 text-xs font-semibold uppercase opacity-60 tracking-wider opacity-0 animate-fade-in-blur-slower">
              Relatórios
            </div>
          )}
          <Item to="/cleaning-report" icon={Brush} showText={showText}>
            Relatório de Limpeza
          </Item>

          {/* 🔹 Destaque especial para o Relatório de Desempenho */}
          <Item
            to="/performance-report"
            icon={BarChart3}
            showText={showText}
            highlight
          >
            Relatório de Desempenho
          </Item>
        </nav>

        {/* BASE FIXA */}
        <div className="p-3 space-y-2 border-t border-white/10 shadow-[0_-2px_6px_rgba(0,0,0,0.3)]">
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 transition-colors duration-300 ease-out"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {showText && (
              <span className="ml-2 text-sm opacity-0 animate-fade-in-blur-slowest">
                Recolher
              </span>
            )}
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 transition-colors duration-300 ease-out"
          >
            <LogOut size={18} />
            {showText && (
              <span className="ml-2 text-sm opacity-0 animate-fade-in-blur-slowest">
                Sair
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="flex-1 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
