import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { isViewer } from "../lib/permissions";
import { useApi } from "../lib/api";
import dayjs from "dayjs";
import {
  LayoutDashboard,
  BrushCleaning,
  Bubbles,
  ListCheck,
  Check,
  SquareArrowRight as SquareArrowRightExit,
  MapPinCheckInside,
  CheckLine,
  TicketsPlane,
  BadgeInfo,
  Map,
  Brush,
  Wrench,
  Users,
  Puzzle,
  UsersRound,
  MessageSquareText,
  Building,
  Bed,
  UserCog,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LogOut,
  BarChart3,
  ClipboardList,
  Bell,
  Package,
  ShoppingCart,
  Settings2,
  Boxes,
  Sun,
  Moon,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  buildCheckinAlert,
  buildCleaningCoverageAlert,
  getCheckinAlertSummary,
  getCleaningCoverageSummary,
  mapCheckoutTask,
} from "../lib/operationalAlerts";
import {
  GUEST_CHECKOUT_SETTINGS_EVENT,
  getDailyGuestCheckoutSummary,
} from "../pages/guestCheckoutShared";
import {
  buildMaidListAlert,
  getMaidListDeliverySummary,
  MAID_ASSIGNMENTS_SETTINGS_EVENT,
} from "../pages/maidAssignmentsShared";
import { getWeeklyPresentationSummary } from "../pages/guestPresentationShared";
import { buildMaintenanceAlert, getMaintenanceAlertSummary } from "../pages/maintenanceShared";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

function getInitialSidebarCollapsed() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

// ======================= COMPONENTE ITEM =======================
const Item = ({ to, children, icon: Icon, showText, highlight, hasNotification = false }) => {
  const label = typeof children === "string" ? children : "";

  return (
    <div className="relative group">
      <NavLink
        to={to}
        className={({ isActive }) =>
          `relative flex items-center gap-3 px-3 py-2 rounded-xl transition-colors duration-200 ease-out
          ${isActive
            ? highlight
              ? "bg-indigo-50 text-indigo-700 font-semibold ring-1 ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-200 dark:ring-indigo-400/25"
              : "bg-sky-50 text-sky-800 font-semibold ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-100 dark:ring-sky-400/25"
            : highlight
              ? "text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-200"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          }`
        }
      >
        {Icon && (
          <Icon
            size={18}
            className={`transition-transform duration-200 ${!showText ? "" : ""
              }`}
          />
        )}

        {showText && (
          <span
            className={`text-sm ${highlight ? "font-medium" : ""
              }`}
          >
            {children}
          </span>
        )}

        {hasNotification ? (
          <span
            aria-hidden="true"
            className={`rounded-full bg-rose-500 shadow-[0_0_0_3px_rgba(255,255,255,0.9)] dark:bg-rose-400 dark:shadow-[0_0_0_3px_rgba(15,23,42,0.58)] ${showText ? "ml-auto h-2.5 w-2.5" : "absolute right-2 top-2 h-2.5 w-2.5"
              }`}
          />
        ) : null}
      </NavLink>

      {/* Tooltip somente quando a barra está recolhida */}
      {!showText && label && (
        <span
          className="
            pointer-events-none
            absolute left-full top-1/2 -translate-y-1/2 ml-3
            rounded-md bg-slate-950 text-white text-xs
            px-2 py-1
            whitespace-nowrap
            opacity-0 group-hover:opacity-100 group-hover:translate-x-1
            transition-all duration-150
            z-50 shadow-lg
          "
        >
          {label}
        </span>
      )}
    </div>
  );
};

// ======================= GRUPO DE NAVEGAÇÃO =======================
const NavGroup = ({
  label,
  icon: Icon,
  isOpen,
  onToggle,
  showText,
  children,
  hasNotification = false,
}) => {
  const [flyoutOpen, setFlyoutOpen] = useState(false);

  const renderedChildren = !showText
    ? React.Children.map(children, (child) =>
      React.isValidElement(child) ? React.cloneElement(child, { showText: true }) : child
    )
    : children;

  // Modo barra recolhida: só ícone com tooltip
  if (!showText) {
    return (
      <div className="mt-3">
        <div
          className="relative flex justify-center"
          onMouseEnter={() => setFlyoutOpen(true)}
          onMouseLeave={() => setFlyoutOpen(false)}
          onFocus={() => setFlyoutOpen(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setFlyoutOpen(false);
            }
          }}
        >
          <button
            type="button"
            onClick={onToggle}
            aria-label={label}
            className="
              relative
              w-10 h-10
              flex items-center justify-center
              rounded-xl
              bg-slate-100 hover:bg-slate-200
              border border-slate-200 text-slate-700
              dark:bg-white/5 dark:hover:bg-white/15
              dark:border-white/10 dark:text-slate-100
              transition-colors duration-200
            "
          >
            {Icon && <Icon size={18} className="text-current" />}
            {hasNotification ? (
              <span
                aria-hidden="true"
                className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_0_3px_rgba(255,255,255,0.9)] dark:bg-rose-400 dark:shadow-[0_0_0_3px_rgba(15,23,42,0.58)]"
              />
            ) : null}
          </button>

          <div
            onClickCapture={() => setFlyoutOpen(false)}
            className={`
              absolute left-full top-0 min-w-56
              rounded-2xl border border-slate-200 bg-white/95 p-2 text-slate-700
              shadow-2xl shadow-slate-950/16 backdrop-blur
              dark:border-white/10 dark:bg-slate-950/95 dark:text-slate-200 dark:shadow-slate-950/40
              transition-all duration-150
              z-[100]
              ${flyoutOpen
                ? "visible pointer-events-auto translate-x-0 opacity-100"
                : "invisible pointer-events-none translate-x-1 opacity-0"
              }
            `}
          >
            <div className="mb-2 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              {label}
            </div>
            <div className="space-y-1">
              {renderedChildren}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Modo barra expandida: botão + lista de itens
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
          text-slate-500 dark:text-slate-300/80
          bg-slate-100/80 hover:bg-slate-200/80
          border border-slate-200
          dark:bg-white/5 dark:hover:bg-white/10
          dark:border-white/10
          transition-colors duration-200
        "
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} className="opacity-80" />}
          <span>{label}</span>
        </div>
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""
            }`}
        />
      </button>

      <div
        className={`
          mt-2 space-y-1 overflow-hidden
          transition-all duration-200
          ${isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}
        `}
      >
        {renderedChildren}
      </div>
    </div>
  );
};

// ======================= DASHBOARD LAYOUT =======================
export default function DashboardLayout() {
  const api = useApi();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const viewerOnly = isViewer(user);
  const [alertReservations, setAlertReservations] = useState([]);
  const [alertCheckouts, setAlertCheckouts] = useState([]);
  const [alertMaintenance, setAlertMaintenance] = useState([]);

  const [collapsed, setCollapsed] = useState(getInitialSidebarCollapsed);
  const [showText, setShowText] = useState(() => !getInitialSidebarCollapsed());
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [groupsOpen, setGroupsOpen] = useState({
    cadastros: false,
    estoque: false,
    relatorios: false,
  });

  // Sincroniza texto com expansão/recolhimento
  useEffect(() => {
    if (!collapsed) {
      const timer = setTimeout(() => setShowText(true), 250);
      return () => clearTimeout(timer);
    } else {
      setShowText(false);
    }
  }, [collapsed]);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "true" : "false");
  }, [collapsed]);

  const toggleSidebar = () => {
    setCollapsed((prev) => !prev);
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
      "/cleaning-reminders",
      "/apresentacao-hospedes",
      "/guest-checkins",
      "/guest-checkouts",
    ].includes(path);

    const inEstoque = [
      "/products",
      "/inventory",
      "/purchases",
      "/consumption",
    ].includes(path);

    const inRelatorios = ["/cleaning-report", "/performance-report"].includes(
      path
    );

    setGroupsOpen((prev) => ({
      cadastros: inCadastros || prev.cadastros,
      estoque: inEstoque || prev.estoque,
      relatorios: inRelatorios || prev.relatorios,
    }));
  }, [location.pathname]);

  const toggleGroup = (key) => {
    setGroupsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    let isMounted = true;

    const loadSidebarAlerts = async () => {
      try {
        const startWeek = dayjs().startOf("week").format("YYYY-MM-DD");
        const endWindow = dayjs().endOf("week").add(1, "week").format("YYYY-MM-DD");
        const [reservationsResponse, checkoutsResponse, maintenanceResponse] = await Promise.all([
          api("/reservations"),
          api(`/tasks/checkouts?start=${startWeek}&end=${endWindow}`),
          api("/maintenance"),
        ]);

        if (!isMounted) return;

        setAlertReservations(Array.isArray(reservationsResponse) ? reservationsResponse : []);
        setAlertCheckouts(
          Array.isArray(checkoutsResponse) ? checkoutsResponse.map(mapCheckoutTask) : []
        );
        setAlertMaintenance(Array.isArray(maintenanceResponse) ? maintenanceResponse : []);
      } catch (err) {
        console.error("Erro ao carregar alertas operacionais do menu:", err);
      }
    };

    loadSidebarAlerts();

    const intervalId = window.setInterval(loadSidebarAlerts, 60000);
    window.addEventListener("focus", loadSidebarAlerts);
    window.addEventListener("storage", loadSidebarAlerts);
    window.addEventListener(MAID_ASSIGNMENTS_SETTINGS_EVENT, loadSidebarAlerts);
    window.addEventListener(GUEST_CHECKOUT_SETTINGS_EVENT, loadSidebarAlerts);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", loadSidebarAlerts);
      window.removeEventListener("storage", loadSidebarAlerts);
      window.removeEventListener(MAID_ASSIGNMENTS_SETTINGS_EVENT, loadSidebarAlerts);
      window.removeEventListener(GUEST_CHECKOUT_SETTINGS_EVENT, loadSidebarAlerts);
    };
  }, [api, location.pathname]);

  const tomorrowStr = dayjs().add(1, "day").format("YYYY-MM-DD");
  const checkinAlert = useMemo(
    () => buildCheckinAlert(getCheckinAlertSummary(alertReservations, dayjs())),
    [alertReservations]
  );
  const presentationSummary = useMemo(
    () => getWeeklyPresentationSummary(alertReservations, dayjs()),
    [alertReservations]
  );
  const guestCheckoutSummary = useMemo(
    () => getDailyGuestCheckoutSummary(alertReservations, dayjs()),
    [alertReservations]
  );
  const maidAssignmentsAlert = useMemo(
    () =>
      buildMaidListAlert(getMaidListDeliverySummary(alertCheckouts, tomorrowStr), "amanha"),
    [alertCheckouts, tomorrowStr]
  );
  const cleaningAlert = useMemo(
    () => buildCleaningCoverageAlert(getCleaningCoverageSummary(alertCheckouts, dayjs())),
    [alertCheckouts]
  );
  const maintenanceAlert = useMemo(
    () => buildMaintenanceAlert(getMaintenanceAlertSummary(alertMaintenance, dayjs())),
    [alertMaintenance]
  );

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
    <div className="app-shell-bg min-h-dvh w-full flex text-slate-900 dark:text-slate-100">
      {/* SIDEBAR */}
      <aside
        className={`
          h-dvh
          app-sidebar
          flex flex-col
          transition-[width] duration-300 ease-out
          sticky top-0 z-50
          ${collapsed ? "w-[72px] overflow-visible" : "w-[260px] overflow-hidden"}
        `}
      >
        {/* TOPO */}
        <div className="p-4 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-center shrink-0">
          {collapsed ? (
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-600/20">
              <Building
                size={22}
                className="transition-transform duration-300 ease-out"
              />
            </div>
          ) : (
            <div className="flex w-full items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-600/20">
                <Building size={21} />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-black tracking-wide text-slate-950 dark:text-white">
                  StayCore
                </span>
                <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-sky-200/70">
                  PMS
                </span>
              </div>
            </div>
          )}
        </div>

        {/* USUÁRIO */}
        <div
          className={`
            shrink-0 overflow-hidden border-b border-slate-200/70
            transition-[max-height,opacity,transform] duration-300 ease-out
            dark:border-white/10
            ${user && showText
              ? "max-h-20 translate-y-0 opacity-100"
              : "max-h-0 -translate-y-1 opacity-0"
            }
          `}
        >
          <div className="px-4 py-3">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 shadow-sm shadow-slate-900/5 dark:border-white/10 dark:bg-white/5">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user?.name || "Usuario"}
                  className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-md shadow-sky-600/20 ring-1 ring-slate-200/70 dark:ring-white/10"
                />
              ) : (
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-600 text-sm font-black text-white shadow-md shadow-sky-600/20">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
              )}
              <div className="min-w-0">
                <div className="font-serif text-[13px] italic leading-none text-slate-400 dark:text-slate-500">
                  Olá,
                </div>
                <div className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {user?.name}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO */}
        <nav className={`flex-1 px-2 py-4 space-y-1 ${collapsed ? "overflow-visible" : "overflow-y-auto"}`}>
          {/* Atalhos principais */}
          <Item to="/dashboard" icon={LayoutDashboard} showText={showText}>
            Dashboard
          </Item>
          <Item
            to="/map"
            icon={Map}
            showText={showText}
            hasNotification={checkinAlert.isPending}
          >
            Mapa de Reservas
          </Item>
          {!viewerOnly && (
            <Item
              to="/cleaning-schedule"
              icon={Bubbles}
              showText={showText}
              hasNotification={cleaningAlert.isPending}
            >
              Controle Limpeza
            </Item>
          )}
          {!viewerOnly && (
            <Item
              to="/maintenance-calendar"
              icon={CalendarDays}
              showText={showText}
            >
              Agenda de Atividades
            </Item>
          )}
          {!viewerOnly && (
            <Item
              to="/maid-assignments"
              icon={UsersRound}
              showText={showText}
              hasNotification={maidAssignmentsAlert.isPending}
            >
              Listagem Diaristas
            </Item>
          )}
          {!viewerOnly && (
            <Item
              to="/apresentacao-hospedes"
              icon={ListCheck}
              showText={showText}
              hasNotification={presentationSummary.pending > 0}
            >
              Apresentação Hóspedes
            </Item>
          )}
          {!viewerOnly && (
            <Item
              to="/guest-checkins"
              icon={MapPinCheckInside}
              showText={showText}
              hasNotification={checkinAlert.isPending}
            >
              Check-ins Hóspedes
            </Item>
          )}
          {!viewerOnly && (
            <Item
              to="/guest-checkouts"
              icon={SquareArrowRightExit}
              showText={showText}
              hasNotification={guestCheckoutSummary.pending > 0}
            >
              Check-outs Hóspedes
            </Item>
          )}

          {/* Grupos */}
          <div className="mt-4 space-y-2">
            {/* CADASTROS */}
            {!viewerOnly && (
              <NavGroup
                label="Cadastros"
                icon={ClipboardList}
                isOpen={groupsOpen.cadastros}
                onToggle={() => toggleGroup("cadastros")}
                showText={showText}
                hasNotification={maintenanceAlert.isPending}
              >
                <Item
                  to="/maintenance"
                  icon={Wrench}
                  showText={showText}
                  hasNotification={maintenanceAlert.isPending}
                >
                  Atividades
                </Item>
                <Item to="/reservations" icon={ClipboardList} showText={showText}>
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
                <Item to="/cleaning-reminders" icon={Bell} showText={showText}>
                  Lembretes de Limpeza
                </Item>
              </NavGroup>
            )}

            {/* ESTOQUE */}
            {!viewerOnly && (
              <NavGroup
                label="Estoque"
                icon={Boxes}
                isOpen={groupsOpen.estoque}
                onToggle={() => toggleGroup("estoque")}
                showText={showText}
              >
                <Item to="/products" icon={Package} showText={showText}>
                  Produtos
                </Item>
                <Item to="/inventory" icon={Boxes} showText={showText}>
                  Inventário
                </Item>
                <Item to="/purchases" icon={ShoppingCart} showText={showText}>
                  Compras
                </Item>
                <Item to="/consumption" icon={Settings2} showText={showText}>
                  Perfis de Consumo
                </Item>
              </NavGroup>
            )}

            {/* RELATÓRIOS */}
            <NavGroup
              label="Relatórios"
              icon={BarChart3}
              isOpen={groupsOpen.relatorios}
              onToggle={() => toggleGroup("relatorios")}
              showText={showText}
            >
              {!viewerOnly && <Item to="/cleaning-report" icon={Brush} showText={showText}>
                Relatório de Limpeza
              </Item>}
              <Item
                to="/performance-report"
                icon={BarChart3}
                showText={showText}
              >
                Relatório de Desempenho
              </Item>
            </NavGroup>
          </div>
        </nav>

        {/* BASE FIXA – sempre visível */}
        <div className="p-3 space-y-2 border-t border-slate-200/70 bg-slate-50/80 shadow-[0_-14px_35px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-slate-950/60 dark:shadow-[0_-14px_35px_rgba(0,0,0,0.22)] shrink-0">
          {collapsed && user ? (
            <div className="flex justify-center pb-1">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user?.name || "Usuario"}
                  title={user?.name || "Usuario"}
                  className="h-11 w-11 rounded-full object-cover shadow-lg shadow-sky-600/15 ring-2 ring-white dark:ring-slate-800"
                />
              ) : (
                <div
                  title={user?.name || "Usuario"}
                  className="grid h-11 w-11 place-items-center rounded-full bg-sky-600 text-sm font-black text-white shadow-lg shadow-sky-600/20 ring-2 ring-white dark:ring-slate-800"
                >
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
              )}
            </div>
          ) : null}

          {/* Toggle Tema */}
          <button
            onClick={toggleTheme}
            aria-label={`Ativar modo ${isDark ? "claro" : "escuro"}`}
            className={`
              group
              w-full flex items-center justify-center
              px-3 py-2
              rounded-xl
              border border-slate-200
              bg-white
              hover:bg-slate-100
              text-slate-700
              dark:border-white/10
              dark:bg-white/5
              dark:hover:bg-white/15
              dark:text-slate-100
              transition-colors duration-200 ease-out
              ${isDark ? "shadow-[0_0_14px_rgba(56,189,248,0.45)]" : ""}
            `}
          >
            <div className="flex items-center gap-2">
              {isDark ? (
                <Sun
                  size={18}
                  className="transition-transform duration-200 group-hover:rotate-12"
                />
              ) : (
                <Moon
                  size={18}
                  className="transition-transform duration-200 group-hover:-rotate-12"
                />
              )}

              {showText && (
                <div className="flex flex-col items-start">
                  <span className="text-xs uppercase tracking-wide opacity-70">
                    Tema
                  </span>
                  <span className="text-sm font-medium">
                    {isDark ? "Claro" : "Escuro"}
                  </span>
                </div>
              )}
            </div>
          </button>

          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-colors duration-200 ease-out dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/15"
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {showText && (
              <span className="ml-2 text-sm">
                Recolher
              </span>
            )}
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center justify-center px-3 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors duration-200 ease-out"
          >
            <LogOut size={18} />
            {showText && (
              <span className="ml-2 text-sm">
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
          py-5
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
            duration-200
          "
        >
          <ChevronUp size={18} />
        </button>
      )}
    </div>
  );
}
