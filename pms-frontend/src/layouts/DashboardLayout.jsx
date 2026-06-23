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
  KeyRound,
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
  Boxes,
  Sun,
  Moon,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Trophy,
  ShieldCheck,
  TrendingUp,
  X,
} from "lucide-react";
import {
  buildCheckinAlert,
  buildCleaningCoverageAlert,
  getCheckinAlertSummary,
  getCleaningCoverageSummary,
  mapCheckoutTask,
} from "../lib/operationalAlerts";
import {
  buildGuestCheckoutAlert,
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
import {
  getInventoryOpenedDate,
  INVENTORY_DAILY_OPENED_EVENT,
} from "../pages/inventoryIntelligenceShared";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

function pluralByCount(count, singular, plural) {
  return Number(count) > 1 ? plural : singular;
}

function pendingText(count) {
  return pluralByCount(count, "pendente", "pendentes");
}

function completedVerbText(count) {
  return pluralByCount(count, "foi concluida", "foram concluidas");
}

function getInitialSidebarCollapsed() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
}

// ======================= COMPONENTE ITEM =======================
const Item = ({
  to,
  children,
  icon: Icon,
  showText,
  highlight,
  hasNotification = false,
  neutralActive = false,
}) => {
  const label = typeof children === "string" ? children : "";

  return (
    <div className="relative group">
      <NavLink
        to={to}
        className={({ isActive }) =>
          `relative flex items-center gap-3 px-3 py-2 rounded-xl transition-colors duration-200 ease-out
          ${isActive
            ? neutralActive
              ? "bg-slate-100 text-slate-950 font-semibold ring-1 ring-slate-200 dark:bg-white/10 dark:text-white dark:ring-white/10"
              : highlight
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
  collapsed,
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
  if (collapsed) {
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
        <div className="flex min-w-0 items-center gap-2">
          {Icon && <Icon size={14} className="shrink-0 opacity-80" />}
          <span
            className={`
              overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-200 ease-out
              ${showText ? "max-w-40 translate-x-0 opacity-100" : "max-w-0 -translate-x-1 opacity-0"}
            `}
          >
            {label}
          </span>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 transition-[opacity,transform] duration-200 ${isOpen ? "rotate-180" : ""
            } ${showText ? "opacity-100" : "opacity-0"
            }`}
        />
      </button>

      <div
        className={`
          mt-2 space-y-1 overflow-hidden
          transition-all duration-200
          ${showText && isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}
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
  const [inventoryOpenedDate, setInventoryOpenedDate] = useState(() => getInventoryOpenedDate());
  const [questsOpen, setQuestsOpen] = useState(false);

  const [collapsed, setCollapsed] = useState(getInitialSidebarCollapsed);
  const [showText, setShowText] = useState(() => !getInitialSidebarCollapsed());
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [groupsOpen, setGroupsOpen] = useState({
    cadastros: false,
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
      "/maintenance-collaborators",
      "/cleaning-reminders",
      "/apresentacao-hospedes",
      "/guest-checkins",
      "/assisted-checkins",
      "/guest-checkouts",
      "/cleaning-integrity",
    ].includes(path);

    const inRelatorios = ["/cleaning-report", "/performance-report", "/performance-report-2"].includes(
      path
    );

    setGroupsOpen((prev) => ({
      cadastros: inCadastros || prev.cadastros,
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

  useEffect(() => {
    const refreshInventoryOpenedDate = () => setInventoryOpenedDate(getInventoryOpenedDate());
    refreshInventoryOpenedDate();

    const intervalId = window.setInterval(refreshInventoryOpenedDate, 60000);
    window.addEventListener("focus", refreshInventoryOpenedDate);
    window.addEventListener("storage", refreshInventoryOpenedDate);
    window.addEventListener(INVENTORY_DAILY_OPENED_EVENT, refreshInventoryOpenedDate);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshInventoryOpenedDate);
      window.removeEventListener("storage", refreshInventoryOpenedDate);
      window.removeEventListener(INVENTORY_DAILY_OPENED_EVENT, refreshInventoryOpenedDate);
    };
  }, []);

  const tomorrowStr = dayjs().add(1, "day").format("YYYY-MM-DD");
  const inventoryNeedsDailyOpen = inventoryOpenedDate !== dayjs().format("YYYY-MM-DD");
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
  const guestCheckoutAlert = useMemo(
    () => buildGuestCheckoutAlert(guestCheckoutSummary),
    [guestCheckoutSummary]
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
  const questItems = useMemo(() => {
    const checkinSummary = getCheckinAlertSummary(alertReservations, dayjs());
    const presentationPending = presentationSummary.pending > 0;
    const presentationMessage = presentationPending
      ? `Alerta: ${presentationSummary.pending} de ${presentationSummary.total} ${pluralByCount(presentationSummary.total, "apresentacao", "apresentacoes")} da semana ainda ${pendingText(presentationSummary.pending)}.`
      : presentationSummary.total > 0
        ? `Tudo certo: ${presentationSummary.completed} de ${presentationSummary.total} ${pluralByCount(presentationSummary.total, "apresentacao", "apresentacoes")} da semana ${completedVerbText(presentationSummary.completed)}.`
        : "Tudo certo: nao ha apresentacao prevista na semana.";

    return [
      {
        id: "checkins",
        title: "Portao de Chegada",
        route: "/guest-checkins",
        icon: MapPinCheckInside,
        isPending: checkinAlert.isPending,
        progress: `${checkinSummary.finished}/${Math.max(checkinSummary.total, 1)}`,
        message: checkinAlert.message,
      },
      {
        id: "presentations",
        title: "Ritual de Boas-vindas",
        route: "/apresentacao-hospedes",
        icon: ListCheck,
        isPending: presentationPending,
        progress: `${presentationSummary.completed}/${Math.max(presentationSummary.total, 1)}`,
        message: presentationMessage,
      },
      {
        id: "checkouts",
        title: "Pergaminhos de Saida",
        route: "/guest-checkouts",
        icon: SquareArrowRightExit,
        isPending: guestCheckoutAlert.isPending,
        progress: `${guestCheckoutSummary.sent}/${Math.max(guestCheckoutSummary.total, 1)}`,
        message: guestCheckoutAlert.message,
      },
      {
        id: "maids",
        title: "Guilda das Diaristas",
        route: "/maid-assignments",
        icon: UsersRound,
        isPending: maidAssignmentsAlert.isPending,
        progress: maidAssignmentsAlert.isPending ? "acao" : "ok",
        message: maidAssignmentsAlert.message,
      },
      {
        id: "cleaning",
        title: "Mapa da Limpeza",
        route: "/cleaning-schedule",
        icon: Bubbles,
        isPending: cleaningAlert.isPending,
        progress: cleaningAlert.isPending ? "acao" : "ok",
        message: cleaningAlert.message,
      },
      {
        id: "maintenance",
        title: "Agenda de Atividades",
        route: "/maintenance-calendar",
        icon: CalendarDays,
        isPending: maintenanceAlert.isPending,
        progress: maintenanceAlert.isPending ? "acao" : "ok",
        message: maintenanceAlert.message,
      },
    ];
  }, [
    alertReservations,
    checkinAlert,
    presentationSummary,
    guestCheckoutAlert,
    guestCheckoutSummary,
    maidAssignmentsAlert,
    cleaningAlert,
    maintenanceAlert,
  ]);
  const pendingQuestCount = questItems.filter((quest) => quest.isPending).length;

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
                <button
                  type="button"
                  onClick={() => setQuestsOpen(true)}
                  title="Abrir quests"
                  className="h-9 w-9 shrink-0 overflow-hidden rounded-xl shadow-md shadow-sky-600/20 ring-1 ring-slate-200/70 transition hover:scale-105 hover:ring-sky-300 dark:ring-white/10 dark:hover:ring-sky-400"
                >
                  <img
                    src={user.imageUrl}
                    alt={user?.name || "Usuario"}
                    className="h-full w-full object-cover"
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setQuestsOpen(true)}
                  title="Abrir quests"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-600 text-sm font-black text-white shadow-md shadow-sky-600/20 transition hover:scale-105 hover:bg-sky-700"
                >
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </button>
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
              hasNotification={maintenanceAlert.isPending}
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
              to="/assisted-checkins"
              icon={KeyRound}
              showText={showText}
            >
              Check-ins presenciais
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
          {!viewerOnly && (
            <Item
              to="/cleaning-integrity"
              icon={ShieldCheck}
              showText={showText}
            >
              Integridade da Limpeza
            </Item>
          )}
          {!viewerOnly && (
            <Item
              to="/inventory"
              icon={Boxes}
              showText={showText}
              hasNotification={inventoryNeedsDailyOpen}
              neutralActive
            >
              Inventário
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
                collapsed={collapsed}
              >
                <Item
                  to="/maintenance"
                  icon={Wrench}
                  showText={showText}
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
                <Item to="/maintenance-collaborators" icon={UserCog} showText={showText}>
                  Colaboradores
                </Item>
                <Item to="/cleaning-reminders" icon={Bell} showText={showText}>
                  Lembretes de Limpeza
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
              collapsed={collapsed}
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
              <Item
                to="/performance-report-2"
                icon={TrendingUp}
                showText={showText}
              >
                Relatório de Desempenho 2
              </Item>
            </NavGroup>
          </div>
        </nav>

        {/* BASE FIXA – sempre visível */}
        <div className="p-3 space-y-2 border-t border-slate-200/70 bg-slate-50/80 shadow-[0_-14px_35px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-slate-950/60 dark:shadow-[0_-14px_35px_rgba(0,0,0,0.22)] shrink-0">
          {collapsed && user ? (
            <div className="flex justify-center pb-1">
              {user?.imageUrl ? (
                <button
                  type="button"
                  onClick={() => setQuestsOpen(true)}
                  title="Abrir quests"
                  className="h-11 w-11 overflow-hidden rounded-full shadow-lg shadow-sky-600/15 ring-2 ring-white transition hover:scale-105 hover:ring-sky-300 dark:ring-slate-800 dark:hover:ring-sky-400"
                >
                  <img
                    src={user.imageUrl}
                    alt={user?.name || "Usuario"}
                    className="h-full w-full object-cover"
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setQuestsOpen(true)}
                  title="Abrir quests"
                  className="grid h-11 w-11 place-items-center rounded-full bg-sky-600 text-sm font-black text-white shadow-lg shadow-sky-600/20 ring-2 ring-white transition hover:scale-105 hover:bg-sky-700 dark:ring-slate-800"
                >
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </button>
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
      {questsOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/72 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quests-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setQuestsOpen(false);
          }}
        >
          <div className="relative max-h-[88dvh] w-full max-w-4xl overflow-hidden rounded-xl border border-amber-900/40 bg-[#f2e3bc] text-stone-900 shadow-2xl shadow-slate-950/55">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.34),transparent_24%),radial-gradient(circle_at_84%_18%,rgba(120,53,15,0.14),transparent_22%),linear-gradient(135deg,rgba(146,64,14,0.10),transparent_32%,rgba(68,64,60,0.08))]" />
            <div className="absolute inset-x-4 top-3 h-px bg-amber-900/30" />
            <div className="absolute inset-x-4 bottom-3 h-px bg-amber-900/30" />
            <div className="relative overflow-y-auto p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-amber-900/25 pb-5">
                <div className="flex items-center gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-full border-2 border-amber-900/45 bg-amber-800 text-amber-100 shadow-lg shadow-amber-950/25">
                    <Trophy size={28} />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-900/30 bg-amber-100/70 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-950">
                      <Sparkles size={13} />
                      Pergaminho diario
                    </div>
                    <h2 id="quests-title" className="mt-2 font-serif text-3xl font-black tracking-tight text-amber-950">
                      Quests da Hospedaria
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-stone-700">
                      As missoes operacionais do dia, seladas pela guilda StayCore.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="rounded-lg border border-amber-900/30 bg-amber-100/65 px-4 py-2 text-right shadow-inner shadow-amber-900/10">
                    <div className="text-2xl font-black text-amber-950">{questItems.length - pendingQuestCount}/{questItems.length}</div>
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-600">concluidas</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuestsOpen(false)}
                    aria-label="Fechar quests"
                    className="grid h-10 w-10 place-items-center rounded-lg border border-amber-900/30 bg-amber-100/70 text-amber-950 transition hover:bg-amber-200"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {questItems.map((quest) => {
                  const QuestIcon = quest.icon;
                  return (
                    <NavLink
                      key={quest.id}
                      to={quest.route}
                      onClick={() => setQuestsOpen(false)}
                      className={`group relative overflow-hidden rounded-lg border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
                        quest.isPending
                          ? "border-amber-900/35 bg-amber-50/80 hover:shadow-amber-900/18"
                          : "border-emerald-900/25 bg-[#ecf0d0]/80 hover:shadow-emerald-900/14"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg border ${
                            quest.isPending
                              ? "border-amber-900/35 bg-amber-200/80 text-amber-950"
                              : "border-emerald-900/25 bg-emerald-100/80 text-emerald-900"
                          }`}
                        >
                          <QuestIcon size={21} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="font-serif text-lg font-black text-amber-950">{quest.title}</div>
                            <div
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                                quest.isPending
                                  ? "border-amber-900/30 bg-amber-200/80 text-amber-950"
                                  : "border-emerald-900/25 bg-emerald-100/80 text-emerald-900"
                              }`}
                            >
                              {quest.isPending ? "pendente" : "ok"}
                            </div>
                          </div>
                          <p className="mt-2 text-sm font-semibold leading-5 text-stone-700">
                            {quest.message}
                          </p>
                          <div className="mt-4 flex items-center justify-between gap-3">
                            <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-stone-600">
                              <ShieldCheck size={14} />
                              progresso {quest.progress}
                            </div>
                            <span className="text-xs font-black uppercase tracking-[0.14em] text-amber-900 opacity-0 transition group-hover:opacity-100">
                              abrir
                            </span>
                          </div>
                        </div>
                      </div>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
