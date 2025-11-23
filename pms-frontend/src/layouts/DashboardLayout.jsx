import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  LayoutDashboard,
  Map,
  Brush,
  Wrench,
  Users,
  Puzzle,
  UsersRound,
  Building,
  Bed,
  UserCog,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LogOut,
  BarChart3,
  ClipboardList,
  Package,
  ShoppingCart,
  Settings2,
  Boxes,
  Sun,
  Moon,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

// ======================= COMPONENTE ITEM =======================
const Item = ({ to, children, icon: Icon, showText, highlight }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-300 ease-out
      ${
        isActive
          ? highlight
            ? "bg-indigo-500/20 text-indigo-200 font-semibold border-l-4 border-indigo-400"
            : "bg-white/15 text-white font-semibold border-l-4 border-sky-400"
          : highlight
          ? "text-indigo-300 hover:bg-indigo-500/10 hover:text-indigo-200"
          : "text-slate-100/80 hover:bg-white/10 hover:text-white"
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

// ======================= GRUPO DE NAVEGAÇÃO =======================
const NavGroup = ({ label, icon: Icon, isOpen, onToggle, children }) => {
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onToggle}
        className="
          w-full flex items-center justify-between
          px-3 py-2
          rounded-lg
          text-[11px] font-semibold uppercase tracking-wide
          text-slate-100/70
          bg-white/5 hover:bg-white/10
          border border-white/10
          transition-all duration-300
        "
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} className="opacity-80" />}
          <span>{label}</span>
        </div>
        <ChevronDown
          size={16}
          className={`transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Conteúdo do grupo */}
      <div
        className={`
          mt-2 space-y-1 overflow-hidden transition-all duration-300
          ${isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}
        `}
      >
        {children}
      </div>
    </div>
  );
};

// ======================= DASHBOARD LAYOUT =======================
export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [showText, setShowText] = useState(!collapsed);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [groupsOpen, setGroupsOpen] = useState({
    cadastros: false,
    estoque: false,
    relatorios: false,
  });

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

  const isDark = theme === "dark";

  // Abre automaticamente o grupo da rota atual
  useEffect(() => {
    const path = location.pathname;

    const inCadastros = [
      "/maintenance",
      "/reservations",
      "/guests",
      "/stays",
      "/rooms",
      "/staff",
      "/maids",
    ].includes(path);

    const inEstoque = [
      "/products",
      "/inventory",
      "/purchases",
      "/consumption",
    ].includes(path);

    const inRelatorios = [
      "/cleaning-report",
      "/performance-report",
    ].includes(path);

    setGroupsOpen((prev) => ({
      cadastros: inCadastros || prev.cadastros,
      estoque: inEstoque || prev.estoque,
      relatorios: inRelatorios || prev.relatorios,
    }));
  }, [location.pathname]);

  const toggleGroup = (key) => {
    setGroupsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Listener de scroll na janela
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop =
        window.scrollY || document.documentElement.scrollTop || 0;
      setShowScrollTop(scrollTop > 200);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleScrollTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div className="min-h-dvh w-full flex bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* SIDEBAR */}
      <aside
        className={`
          bg-gradient-to-b 
          from-sky-800 to-sky-950
          dark:from-slate-950 dark:to-slate-900
          text-white flex flex-col shadow-xl
          transition-[width] duration-400 ease-out overflow-hidden
          sticky top-0
          min-h-dvh md:h-auto
          ${collapsed ? "w-[72px]" : "w-[260px]"}
        `}
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
          <div className="px-4 py-2 text-sm text-slate-100/90 border-b border-white/10 opacity-0 animate-fade-in-blur shrink-0">
            👋 Olá, <span className="font-medium">{user.name}</span>
          </div>
        )}

        {/* NAVEGAÇÃO */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
          {/* Atalhos principais */}
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

          {/* Grupos só aparecem quando o texto está visível (sidebar expandida) */}
          {showText && (
            <div className="mt-4 space-y-2">
              {/* CADASTROS */}
              <NavGroup
                label="Cadastros"
                icon={ClipboardList}
                isOpen={groupsOpen.cadastros}
                onToggle={() => toggleGroup("cadastros")}
              >
                <Item
                  to="/maintenance"
                  icon={Wrench}
                  showText={showText}
                >
                  Atividades
                </Item>
                <Item
                  to="/reservations"
                  icon={ClipboardList}
                  showText={showText}
                >
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
              </NavGroup>

              {/* ESTOQUE */}
              <NavGroup
                label="Estoque"
                icon={Boxes}
                isOpen={groupsOpen.estoque}
                onToggle={() => toggleGroup("estoque")}
              >
                <Item to="/products" icon={Package} showText={showText}>
                  Produtos
                </Item>
                <Item to="/inventory" icon={Boxes} showText={showText}>
                  Inventário
                </Item>
                <Item
                  to="/purchases"
                  icon={ShoppingCart}
                  showText={showText}
                >
                  Compras
                </Item>
                <Item
                  to="/consumption"
                  icon={Settings2}
                  showText={showText}
                >
                  Perfis de Consumo
                </Item>
              </NavGroup>

              {/* RELATÓRIOS */}
              <NavGroup
                label="Relatórios"
                icon={BarChart3}
                isOpen={groupsOpen.relatorios}
                onToggle={() => toggleGroup("relatorios")}
              >
                <Item to="/cleaning-report" icon={Brush} showText={showText}>
                  Relatório de Limpeza
                </Item>
                <Item
                  to="/performance-report"
                  icon={BarChart3}
                  showText={showText}
                >
                  Relatório de Desempenho
                </Item>
              </NavGroup>
            </div>
          )}
        </nav>

        {/* BASE FIXA */}
        <div className="p-3 space-y-2 border-t border-white/10 shadow-[0_-2px_6px_rgba(0,0,0,0.3)] shrink-0">
          {/* Toggle Tema */}
          <button
            onClick={toggleTheme}
            aria-label={`Ativar modo ${isDark ? "claro" : "escuro"}`}
            className={`
              group
              w-full flex items-center justify-center
              px-3 py-2
              rounded-xl
              border border-white/10
              bg-white/5
              hover:bg-white/15
              transition-all duration-300 ease-out
              ${isDark ? "shadow-[0_0_14px_rgba(56,189,248,0.45)]" : ""}
            `}
          >
            <div className="flex items-center gap-2">
              {isDark ? (
                <Sun
                  size={18}
                  className="transition-transform duration-300 group-hover:rotate-12"
                />
              ) : (
                <Moon
                  size={18}
                  className="transition-transform duration-300 group-hover:-rotate-12"
                />
              )}

              {showText && (
                <div className="flex flex-col items-start">
                  <span className="text-xs uppercase tracking-wide opacity-70">
                    Tema
                  </span>
                  <span className="text-sm font-medium opacity-0 group-hover:opacity-100 group-hover:translate-y-[1px] transition-all duration-300">
                    {isDark ? "Claro" : "Escuro"}
                  </span>
                </div>
              )}
            </div>
          </button>

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
      <main className="flex-1 overflow-y-auto min-w-0">
        <div
          className="
          w-full
          mx-auto
          px-4 sm:px-6 lg:px-8
          py-6
          max-w-full
          xl:max-w-[1600px]
          2xl:max-w-[1800px]
        "
        >
          <Outlet />
        </div>
      </main>

      {/* BOTÃO VOLTAR AO TOPO */}
      {showScrollTop && (
        <button
          onClick={handleScrollTop}
          aria-label="Voltar ao topo"
          className="
            fixed
            bottom-6
            right-6
            z-40
            rounded-full
            px-3
            py-3
            bg-sky-600
            hover:bg-sky-700
            dark:bg-sky-500
            dark:hover:bg-sky-400
            shadow-lg
            flex
            items-center
            justify-center
            transition-all
            duration-300
          "
        >
          <ChevronUp size={18} />
        </button>
      )}
    </div>
  );
}
