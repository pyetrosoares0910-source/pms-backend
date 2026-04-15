import React, { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Sparkles, ClipboardList } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";
import dayjs from "dayjs";
import { useApi } from "../lib/api";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import minMax from "dayjs/plugin/minMax";
import utc from "dayjs/plugin/utc";
import isBetween from "dayjs/plugin/isBetween";
import DashboardKPIGrid from "../components/DashboardKPIGrid";
import KpiGaugeOcupacao from "../components/KpiGaugeOcupacao";
import KpiMaintenanceProgress from "../components/KpiMaintenanceProgress";
import KpiTotalReservas from "../components/KpiTotalReservas";
import { useTheme } from "../context/ThemeContext";
import {
  buildCheckinAlert,
  buildCleaningCoverageAlert,
  getCheckinAlertSummary,
  getCleaningCoverageSummary,
} from "../lib/operationalAlerts";
import {
  buildGuestCheckoutAlert,
  getDailyGuestCheckoutSummary,
} from "./guestCheckoutShared";
import { buildMaidListAlert, getMaidListDeliverySummary } from "./maidAssignmentsShared";
import { getWeeklyPresentationSummary } from "./guestPresentationShared";
import { buildMaintenanceAlert, getMaintenanceAlertSummary } from "./maintenanceShared";

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(minMax);
dayjs.extend(utc);
dayjs.extend(isBetween);

function overlapDays(a0, a1, b0, b1) {
  const start = dayjs.max(dayjs(a0), dayjs(b0));
  const end = dayjs.min(dayjs(a1), dayjs(b1));
  const diff = end.diff(start, "day");
  return Math.max(0, diff);
}

function monthBounds(d = new Date()) {
  const start = dayjs(d).startOf("month");
  const end = start.add(1, "month");
  return { start, end, daysInMonth: start.daysInMonth() };
}

function previousMonthEquivalentDay(d = new Date()) {
  const current = dayjs(d).startOf("day");
  const prevMonth = current.subtract(1, "month");
  const safeDay = Math.min(current.date(), prevMonth.daysInMonth());
  return prevMonth.date(safeDay).startOf("day");
}

function getRoomAvailabilityDays(room, start, end) {
  if (!room) return 0;

  const roomCreatedAt = room.createdAt
    ? dayjs(room.createdAt).startOf("day")
    : dayjs(start);

  return overlapDays(roomCreatedAt, end, start, end);
}

function getTotalCapacityDays(rooms, start, end) {
  return (rooms || []).reduce(
    (sum, room) => sum + getRoomAvailabilityDays(room, start, end),
    0
  );
}

function getOccupiedNights(reservations, start, end, roomIdSet = null) {
  return (reservations || []).reduce((sum, reservation) => {
    if (reservation.status === "cancelada") return sum;
    if (roomIdSet && !roomIdSet.has(reservation.roomId)) return sum;

    return (
      sum +
      overlapDays(reservation.checkinDate, reservation.checkoutDate, start, end)
    );
  }, 0);
}

function buildRoomOccupancyRows(rooms, reservations, start, end) {
  const roomMap = new Map(
    (rooms || []).map((room) => [
      room.id,
      {
        room,
        noites: 0,
        capacidade: getRoomAvailabilityDays(room, start, end),
      },
    ])
  );

  (reservations || []).forEach((reservation) => {
    if (reservation.status === "cancelada") return;

    const roomEntry = roomMap.get(reservation.roomId);
    if (!roomEntry) return;

    roomEntry.noites += overlapDays(
      reservation.checkinDate,
      reservation.checkoutDate,
      start,
      end
    );
  });

  return [...roomMap.values()]
    .filter(({ capacidade }) => capacidade > 0)
    .map(({ room, noites, capacidade }) => ({
      roomId: room.id,
      label: room?.title || room?.name || `Quarto ${room.id}`,
      image: room?.imageUrl || room?.image || "/placeholder.jpg",
      noites,
      capacidade,
      ocupacao: Math.min(100, Math.round((noites / capacidade) * 100)),
    }));
}

function buildStayOccupancy(rows, reservations, start, end) {
  const roomsByStay = {};

  rows.forEach((room) => {
    const stayId = room.stay?.id || "none";
    if (!roomsByStay[stayId]) {
      roomsByStay[stayId] = { stayId, stayName: room.stay?.name, rooms: [] };
    }
    roomsByStay[stayId].rooms.push(room);
  });

  return Object.values(roomsByStay)
    .map((group) => {
      const roomSet = new Set(group.rooms.map((room) => room.id));
      const occupiedNights = getOccupiedNights(reservations, start, end, roomSet);
      const capacity = getTotalCapacityDays(group.rooms, start, end);

      if (capacity <= 0) return null;

      return {
        stayId: group.stayId,
        name: group.stayName,
        label: compactStayLabel(group.stayName),
        ocupacao: Math.round((occupiedNights / capacity) * 100),
      };
    })
    .filter(Boolean);
}

function abbrevStay(name) {
  const map = {
    "Itaim Stay (Tabapuã)": "Itaim",
    "Itaim Stay 2 (Tabapuã)": "Itaim 2",
    "JK Stay (Clodomiro)": "JK",
    "Internacional Stay (Urussuí)": "Internacional",
    "Iguatemi Stay A (Butantã)": "Iguatemi A",
    "Iguatemi Stay B (Butantã)": "Iguatemi B",
    "Estanconfor Vila Olímpia": "Vila Olímpia",
  };
  if (map[name]) return map[name];
  return name.split("(")[0].trim();
}

function compactStayLabel(name) {
  const baseLabel = abbrevStay(name || "Sem stay");
  const compactLabel = baseLabel
    .replace(/\bStay\b/gi, "")
    .replace(/\bEdif[ií]cio\b/gi, "Ed.")
    .replace(/\s{2,}/g, " ")
    .trim();

  return compactLabel || baseLabel;
}

function splitStayTickLabel(label, maxLineLength = 14) {
  const normalized = String(label || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [""];
  if (normalized.length <= maxLineLength) return [normalized];

  const words = normalized.split(" ");
  if (words.length === 1) return [normalized];

  let bestIndex = 1;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let i = 1; i < words.length; i += 1) {
    const firstLine = words.slice(0, i).join(" ");
    const secondLine = words.slice(i).join(" ");
    const overflowPenalty =
      Math.max(0, firstLine.length - maxLineLength) +
      Math.max(0, secondLine.length - maxLineLength);
    const balancePenalty = Math.abs(firstLine.length - secondLine.length);
    const score = overflowPenalty * 2 + balancePenalty;

    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return [
    words.slice(0, bestIndex).join(" "),
    words.slice(bestIndex).join(" "),
  ];
}

function StayXAxisTick({ x, y, payload, isDark }) {
  const lines = splitStayTickLabel(payload?.value);

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={16}
        textAnchor="middle"
        fill={isDark ? "#e5e7eb" : "#475569"}
        fontSize={11}
        fontWeight={600}
      >
        {lines.map((line, index) => (
          <tspan key={`${payload?.value}-${index}`} x={0} dy={index === 0 ? 0 : 12}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function getOverallOccupancyPct(reservations, rooms, referenceDate) {
  const { start, end } = monthBounds(referenceDate);
  const roomIdSet = new Set((rooms || []).map((room) => room.id));
  const totalNoites = getOccupiedNights(reservations, start, end, roomIdSet);
  const capacidadeTotal = getTotalCapacityDays(rooms, start, end);

  return capacidadeTotal > 0
    ? Math.round((totalNoites / capacidadeTotal) * 100)
    : 0;
}

function buildMonthlyOccupancyTrend(reservations, rooms, totalMonths = 12) {
  return Array.from({ length: totalMonths }, (_, index) => {
    const monthsAgo = totalMonths - 1 - index;
    const referenceDate = dayjs().subtract(monthsAgo, "month");

    return {
      label: referenceDate.format("MMM").toUpperCase(),
      fullLabel: referenceDate.format("MMM/YYYY").toUpperCase(),
      monthKey: referenceDate.format("YYYY-MM"),
      value: getOverallOccupancyPct(reservations, rooms, referenceDate),
    };
  });
}

export default function Dashboard() {
  const api = useApi();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [reservations, setReservations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tasksMonth, setTasksMonth] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [tasksMonthPrev, setTasksMonthPrev] = useState([]);
  const [selectedCleaningEvent, setSelectedCleaningEvent] = useState(null);


  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const startWeek = dayjs().startOf("week").format("YYYY-MM-DD");
        const endWeek = dayjs().endOf("week").add(1, "week").format("YYYY-MM-DD");

        const startMonth = dayjs().startOf("month").format("YYYY-MM-DD");
        const endMonth = dayjs().endOf("month").format("YYYY-MM-DD");

        const prevMonthStart = dayjs()
          .subtract(1, "month")
          .startOf("month")
          .format("YYYY-MM-DD");
        const prevMonthEnd = dayjs()
          .subtract(1, "month")
          .endOf("month")
          .format("YYYY-MM-DD");

        const [
          rsv,
          rms,
          checkoutsWeek,
          maint,
          checkoutsMonth,
          checkoutsPrevMonth,
        ] = await Promise.all([
          api("/reservations"),
          api("/rooms"),
          api(`/tasks/checkouts?start=${startWeek}&end=${endWeek}`),
          api("/maintenance"),
          api(`/tasks/checkouts?start=${startMonth}&end=${endMonth}`),
          api(`/tasks/checkouts?start=${prevMonthStart}&end=${prevMonthEnd}`),
        ]);

        if (!isMounted) return;

        const mappedWeek = (checkoutsWeek || []).map((t) => ({
          id: t.id,
          date: dayjs.utc(t.date || t.checkoutDate).format("YYYY-MM-DD"),
          stay: t.stay || "Sem Stay",
          rooms: t.rooms || "Sem identificação",
          maid: t.maid || null,
          maidId: t.maidId || null,
        }));

        const mappedMonth = (checkoutsMonth || []).map((t) => ({
          id: t.id,
          date: dayjs.utc(t.date || t.checkoutDate).format("YYYY-MM-DD"),
          stay: t.stay || "Sem Stay",
          rooms: t.rooms || "Sem identificação",
          maid: t.maid || null,
          maidId: t.maidId || null,
        }));

        const mappedPrevMonth = (checkoutsPrevMonth || []).map((t) => ({
          id: t.id,
          date: dayjs.utc(t.date || t.checkoutDate).format("YYYY-MM-DD"),
          stay: t.stay || "Sem Stay",
          rooms: t.rooms || "Sem identificação",
          maid: t.maid || null,
          maidId: t.maidId || null,
        }));

        setReservations(rsv || []);
        setRooms(rms || []);
        setTasks(mappedWeek);
        setTasksMonth(mappedMonth);
        setTasksMonthPrev(mappedPrevMonth);
        setMaintenance(maint || []);
      } catch (err) {
        console.error("Erro ao carregar dashboard:", err);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [api]);

  const todayLocal = dayjs().startOf("day");
  const { start: mStart, end: mEnd } = monthBounds();

  // === Ocupação por empreendimento ===
  const occupancy = useMemo(() => {
    const occRows = buildStayOccupancy(rooms, reservations, mStart, mEnd);

    const avg =
      occRows.length > 0
        ? Math.round(
          occRows.reduce((sum, r) => sum + r.ocupacao, 0) / occRows.length
        )
        : 0;

    return { rows: occRows, avg };
  }, [rooms, reservations, mStart, mEnd]);

  // === Ocupação geral do mês atual ===
  const ocupacaoGeral = useMemo(() => {
    return getOverallOccupancyPct(reservations, rooms, dayjs());
  }, [reservations, rooms]);

  // === Ocupação geral do mês anterior ===
  const ocupacaoGeralPrev = useMemo(() => {
    return getOverallOccupancyPct(reservations, rooms, dayjs().subtract(1, "month"));
  }, [reservations, rooms]);

  // === Ocupação geral do mês retrasado (M-2) ===

  const ocupacaoGeralPrev2 = useMemo(() => {
    return getOverallOccupancyPct(reservations, rooms, dayjs().subtract(2, "month"));
  }, [reservations, rooms]);

  // labels dos meses
  const monthsTrend = useMemo(() => {
    const olderMonths = buildMonthlyOccupancyTrend(reservations, rooms, 12).slice(
      0,
      9
    );

    return [
      ...olderMonths,
      {
        label: dayjs().subtract(2, "month").format("MMM").toUpperCase(),
        fullLabel: dayjs().subtract(2, "month").format("MMM/YYYY").toUpperCase(),
        monthKey: dayjs().subtract(2, "month").format("YYYY-MM"),
        value: ocupacaoGeralPrev2,
      },
      {
        label: dayjs().subtract(1, "month").format("MMM").toUpperCase(),
        fullLabel: dayjs().subtract(1, "month").format("MMM/YYYY").toUpperCase(),
        monthKey: dayjs().subtract(1, "month").format("YYYY-MM"),
        value: ocupacaoGeralPrev,
      },
      {
        label: dayjs().format("MMM").toUpperCase(),
        fullLabel: dayjs().format("MMM/YYYY").toUpperCase(),
        monthKey: dayjs().format("YYYY-MM"),
        value: ocupacaoGeral,
      },
    ];
  }, [reservations, rooms, ocupacaoGeralPrev2, ocupacaoGeralPrev, ocupacaoGeral]);



  // === KPIs principais ===
  const kpis = useMemo(() => {
    const { start: mStart, end: mEnd } = monthBounds();
    const { start: prevStart, end: prevEnd } = monthBounds(
      dayjs().subtract(1, "month")
    );
    const previousEquivalentDay = previousMonthEquivalentDay(todayLocal);
    const currentMonthToDateStart = dayjs(todayLocal).startOf("month");
    const currentMonthToDateEnd = dayjs(todayLocal).add(1, "day");
    const prevMonthToDateStart = dayjs(previousEquivalentDay).startOf("month");
    const prevMonthToDateEnd = dayjs(previousEquivalentDay).add(1, "day");

    const countAssignedCleaningDays = (items, start, end) => {
      const set = new Set();

      (items || []).forEach((t) => {
        if (!t.maid && !t.maidId) return;

        const taskDate = dayjs(t.date);
        if (!taskDate.isBetween(start, end, "day", "[]")) return;

        const key = `${t.date}-${t.maidId || t.maid}`;
        set.add(key);
      });

      return set.size;
    };

    const countCheckoutTasks = (items, start, end) =>
      (items || []).filter((t) =>
        dayjs(t.date).isBetween(start, end, "day", "[]")
      ).length;

    const currentSnapshotOccupancy = buildStayOccupancy(
      rooms,
      reservations,
      currentMonthToDateStart,
      currentMonthToDateEnd
    );
    const prevSnapshotOccupancy = buildStayOccupancy(
      rooms,
      reservations,
      prevMonthToDateStart,
      prevMonthToDateEnd
    );

    const activeToday = reservations.filter(
      (r) =>
        r.status !== "cancelada" &&
        dayjs.utc(r.checkinDate).isSameOrBefore(todayLocal) &&
        dayjs.utc(r.checkoutDate).isAfter(todayLocal)
    ).length;

    const activeTodayPrev = reservations.filter(
      (r) =>
        r.status !== "cancelada" &&
        dayjs.utc(r.checkinDate).isSameOrBefore(previousEquivalentDay) &&
        dayjs.utc(r.checkoutDate).isAfter(previousEquivalentDay)
    ).length;

    const checkinsTodayItems = reservations.filter(
      (r) =>
        r.status !== "cancelada" &&
        dayjs.utc(r.checkinDate).isSame(todayLocal, "day")
    );

    const checkinsToday = checkinsTodayItems.length;
    const pendingCheckinsToday = checkinsTodayItems.filter((r) => {
      const status = String(r.status || "").toLowerCase();
      return status !== "ativa" && status !== "concluida" && status !== "cancelada";
    }).length;
    const finishedCheckinsToday = checkinsToday - pendingCheckinsToday;

    const checkinsTodayPrev = reservations.filter(
      (r) =>
        r.status !== "cancelada" &&
        dayjs.utc(r.checkinDate).isSame(previousEquivalentDay, "day")
    ).length;

    const checkoutsToday = reservations.filter(
      (r) =>
        r.status !== "cancelada" &&
        dayjs.utc(r.checkoutDate).isSame(todayLocal, "day")
    ).length;

    const checkoutsTodayPrev = reservations.filter(
      (r) =>
        r.status !== "cancelada" &&
        dayjs.utc(r.checkoutDate).isSame(previousEquivalentDay, "day")
    ).length;

    const nightsInMonth = reservations.reduce((sum, r) => {
      if (r.status === "cancelada") return sum;
      return sum + overlapDays(r.checkinDate, r.checkoutDate, mStart, mEnd);
    }, 0);

    const totalReservas = reservations.length;

    const reservasMes = reservations.filter((r) => {
      if (!r.checkinDate || !r.checkoutDate) return false;
      const ci = dayjs(r.checkinDate);
      const co = dayjs(r.checkoutDate);
      return (
        r.status !== "cancelada" &&
        (ci.isBetween(mStart, mEnd, null, "[]") ||
          co.isBetween(mStart, mEnd, null, "[]"))
      );
    }).length;

    const checkoutsDoMes = countCheckoutTasks(tasksMonth, mStart, mEnd);

    const diariasLimpeza = countAssignedCleaningDays(tasksMonth, mStart, mEnd);

    const diariasLimpezaMes = diariasLimpeza;

    const mediaDiariasReserva =
      reservasMes > 0 ? (nightsInMonth / reservasMes).toFixed(1) : "-";

    const maiorOcupacao =
      occupancy.rows?.length > 0
        ? occupancy.rows.reduce((a, b) => (a.ocupacao > b.ocupacao ? a : b))
        : null;

    const menorOcupacao =
      occupancy.rows?.length > 0
        ? occupancy.rows.reduce((a, b) => (a.ocupacao < b.ocupacao ? a : b))
        : null;

    const maiorOcupacaoSnapshot =
      currentSnapshotOccupancy.length > 0
        ? currentSnapshotOccupancy.reduce((a, b) =>
            a.ocupacao > b.ocupacao ? a : b
          )
        : null;

    const menorOcupacaoSnapshot =
      currentSnapshotOccupancy.length > 0
        ? currentSnapshotOccupancy.reduce((a, b) =>
            a.ocupacao < b.ocupacao ? a : b
          )
        : null;

    const nightsPrev = reservations.reduce((sum, r) => {
      if (r.status === "cancelada") return sum;
      return (
        sum + overlapDays(r.checkinDate, r.checkoutDate, prevStart, prevEnd)
      );
    }, 0);

    const reservasPrev = reservations.filter((r) => {
      if (r.status === "cancelada") return false;
      const ci = dayjs(r.checkinDate);
      const co = dayjs(r.checkoutDate);
      return (
        ci.isBetween(prevStart, prevEnd, null, "[]") ||
        co.isBetween(prevStart, prevEnd, null, "[]")
      );
    }).length;

    const diariasLimpezaPrev = countAssignedCleaningDays(
      tasksMonthPrev,
      prevStart,
      prevEnd
    );

    const nightsMonthToDate = reservations.reduce((sum, r) => {
      if (r.status === "cancelada") return sum;
      return (
        sum +
        overlapDays(
          r.checkinDate,
          r.checkoutDate,
          currentMonthToDateStart,
          currentMonthToDateEnd
        )
      );
    }, 0);

    const reservasMonthToDate = reservations.filter((r) => {
      if (r.status === "cancelada" || !r.checkinDate || !r.checkoutDate) {
        return false;
      }

      const ci = dayjs(r.checkinDate);
      const co = dayjs(r.checkoutDate);
      return (
        ci.isBetween(currentMonthToDateStart, currentMonthToDateEnd, null, "[]") ||
        co.isBetween(currentMonthToDateStart, currentMonthToDateEnd, null, "[]")
      );
    }).length;

    const checkoutsMonthToDate = countCheckoutTasks(
      tasksMonth,
      currentMonthToDateStart,
      todayLocal
    );

    const diariasLimpezaMonthToDate = countAssignedCleaningDays(
      tasksMonth,
      currentMonthToDateStart,
      todayLocal
    );

    const mediaMonthToDate =
      reservasMonthToDate > 0 ? nightsMonthToDate / reservasMonthToDate : null;

    const eficienciaLimpezaMonthToDate =
      diariasLimpezaMonthToDate > 0
        ? checkoutsMonthToDate / diariasLimpezaMonthToDate
        : null;

    const eficienciaLimpeza =
      eficienciaLimpezaMonthToDate !== null
        ? eficienciaLimpezaMonthToDate.toFixed(1)
        : "-";

    const nightsPrevMonthToDate = reservations.reduce((sum, r) => {
      if (r.status === "cancelada") return sum;
      return (
        sum +
        overlapDays(
          r.checkinDate,
          r.checkoutDate,
          prevMonthToDateStart,
          prevMonthToDateEnd
        )
      );
    }, 0);

    const reservasPrevMonthToDate = reservations.filter((r) => {
      if (r.status === "cancelada" || !r.checkinDate || !r.checkoutDate) {
        return false;
      }

      const ci = dayjs(r.checkinDate);
      const co = dayjs(r.checkoutDate);
      return (
        ci.isBetween(prevMonthToDateStart, prevMonthToDateEnd, null, "[]") ||
        co.isBetween(prevMonthToDateStart, prevMonthToDateEnd, null, "[]")
      );
    }).length;

    const checkoutsPrevMonthToDate = countCheckoutTasks(
      tasksMonthPrev,
      prevMonthToDateStart,
      previousEquivalentDay
    );

    const diariasLimpezaPrevMonthToDate = countAssignedCleaningDays(
      tasksMonthPrev,
      prevMonthToDateStart,
      previousEquivalentDay
    );

    const mediaPrevMonthToDate =
      reservasPrevMonthToDate > 0
        ? nightsPrevMonthToDate / reservasPrevMonthToDate
        : null;

    const eficienciaLimpezaPrevMonthToDate =
      diariasLimpezaPrevMonthToDate > 0
        ? checkoutsPrevMonthToDate / diariasLimpezaPrevMonthToDate
        : null;

    const maiorOcupacaoPrev =
      prevSnapshotOccupancy.length > 0
        ? prevSnapshotOccupancy.reduce((a, b) =>
            a.ocupacao > b.ocupacao ? a : b
          ).ocupacao
        : null;

    const menorOcupacaoPrev =
      prevSnapshotOccupancy.length > 0
        ? prevSnapshotOccupancy.reduce((a, b) =>
            a.ocupacao < b.ocupacao ? a : b
          ).ocupacao
        : null;

    const prev = {
      activeToday: activeTodayPrev,
      checkinsToday: checkinsTodayPrev,
      checkoutsToday: checkoutsTodayPrev,
      nightsInMonth: nightsPrev,
      reservasMes: reservasPrev,
      mediaDiariasReserva:
        mediaPrevMonthToDate !== null ? Number(mediaPrevMonthToDate.toFixed(1)) : null,
      diariasLimpeza: diariasLimpezaPrev,
      eficienciaLimpeza:
        eficienciaLimpezaPrevMonthToDate !== null
          ? Number(eficienciaLimpezaPrevMonthToDate.toFixed(1))
          : null,
      maiorOcupacao: maiorOcupacaoPrev,
      menorOcupacao: menorOcupacaoPrev,
    };

    const compare = {
      maiorOcupacao: maiorOcupacaoSnapshot?.ocupacao ?? null,
      menorOcupacao: menorOcupacaoSnapshot?.ocupacao ?? null,
      mediaDiariasReserva:
        mediaMonthToDate !== null ? Number(mediaMonthToDate.toFixed(1)) : null,
      eficienciaLimpeza:
        eficienciaLimpezaMonthToDate !== null
          ? Number(eficienciaLimpezaMonthToDate.toFixed(1))
          : null,
    };

    const allEfficiency = buildRoomOccupancyRows(rooms, reservations, mStart, mEnd);

    const topEfficiency = allEfficiency
      .slice()
      .sort((a, b) => b.ocupacao - a.ocupacao)
      .slice(0, 10);

    const worstEfficiency = allEfficiency
      .slice()
      .sort((a, b) => a.ocupacao - b.ocupacao)
      .slice(0, 10);

    return {
      activeToday,
      checkinsToday,
      pendingCheckinsToday,
      finishedCheckinsToday,
      checkoutsToday,
      nightsInMonth,
      reservasMes,
      totalReservas,
      eficienciaLimpeza,
      mediaDiariasReserva,
      maiorOcupacao,
      menorOcupacao,
      diariasLimpeza,
      topEfficiency,
      checkoutsDoMes,
      diariasLimpezaMes,
      worstEfficiency,
      allEfficiency,
      prev,
      compare,
    };
  }, [
    reservations,
    occupancy.rows,
    tasksMonth,
    tasksMonthPrev,
    rooms,
    todayLocal,
  ]);

  // === Eventos (Limpeza) ===
  const cleaningEvents = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      const key = `${t.date}-${t.maid || "Sem diarista"}`;
      if (!map[key]) {
        map[key] = {
          id: key,
          title: t.maid || "Sem diarista",
          start: t.date,
          allDay: true,
          details: [],
        };
      }
      map[key].details.push(`${t.stay} – ${t.rooms}`);
    });
    return Object.values(map);
  }, [tasks]);

  // === Eventos (Manutenção) ===
  const maintenanceEvents = useMemo(
    () =>
      (maintenance || []).map((t) => {
        let raw = t.dueDate || t.createdAt;

        if (typeof raw === "string" && raw.endsWith("Z")) {
          raw = raw.slice(0, -1);
        }

        const date = new Date(raw);
        date.setHours(12, 0, 0, 0);

        return {
          id: t.id,
          title: `${t.title}${t.responsible ? " – " + t.responsible : ""}`,
          start: date,
          allDay: true,
        };
      }),
    [maintenance]
  );

  const topEfficiency = Array.isArray(kpis?.topEfficiency)
    ? kpis.topEfficiency
    : [];

  const worstEfficiency = Array.isArray(kpis?.worstEfficiency)
    ? kpis.worstEfficiency
    : [];

  // === Progresso de manutenção ===
  const maintenanceStats = useMemo(() => {
    const total = maintenance.length;
    const pend = maintenance.filter((t) => t.status === "pendente").length;
    const prog = maintenance.filter((t) => t.status === "andamento").length;
    const done = maintenance.filter((t) => t.status === "concluido").length;
    return {
      total,
      pend,
      prog,
      done,
      pctDone: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }, [maintenance]);

  // === Diaristas (Hoje e Amanhã) ===
  const todayStr = dayjs().format("YYYY-MM-DD");
  const tomorrowStr = dayjs().add(1, "day").format("YYYY-MM-DD");

  const maidsToday = useMemo(() => {
    const acc = {};
    tasks.forEach((t) => {
      const taskDate = dayjs(t.date).format("YYYY-MM-DD");
      if (taskDate === todayStr && t.maid) {
        if (!acc[t.maid]) acc[t.maid] = [];
        acc[t.maid].push(`${t.stay} – ${t.rooms}`);
      }
    });
    return acc;
  }, [tasks, todayStr]);

  const maidsTomorrow = useMemo(() => {
    const acc = {};
    tasks.forEach((t) => {
      const taskDate = dayjs(t.date).format("YYYY-MM-DD");
      if (taskDate === tomorrowStr && t.maid) {
        if (!acc[t.maid]) acc[t.maid] = [];
        acc[t.maid].push(`${t.stay} – ${t.rooms}`);
      }
    });
    return acc;
  }, [tasks, tomorrowStr]);

  const weeklyPresentationSummary = useMemo(
    () => getWeeklyPresentationSummary(reservations, dayjs()),
    [reservations]
  );
  const checkinAlertSummary = useMemo(
    () => getCheckinAlertSummary(reservations, dayjs()),
    [reservations]
  );
  const checkinAlert = useMemo(
    () => buildCheckinAlert(checkinAlertSummary),
    [checkinAlertSummary]
  );
  const guestCheckoutSummary = useMemo(
    () => getDailyGuestCheckoutSummary(reservations, dayjs()),
    [reservations]
  );
  const guestCheckoutAlert = useMemo(
    () => buildGuestCheckoutAlert(guestCheckoutSummary),
    [guestCheckoutSummary]
  );
  const maidAssignmentsSummary = useMemo(
    () => getMaidListDeliverySummary(tasks, tomorrowStr),
    [tasks, tomorrowStr]
  );
  const maidAssignmentsAlert = useMemo(
    () => buildMaidListAlert(maidAssignmentsSummary, "amanhã"),
    [maidAssignmentsSummary]
  );
  const maintenanceAlertSummary = useMemo(
    () => getMaintenanceAlertSummary(maintenance, dayjs()),
    [maintenance]
  );
  const maintenanceAlert = useMemo(
    () => buildMaintenanceAlert(maintenanceAlertSummary),
    [maintenanceAlertSummary]
  );
  const cleaningAlertSummary = useMemo(
    () => getCleaningCoverageSummary(tasks, dayjs()),
    [tasks]
  );
  const cleaningAlert = useMemo(
    () => buildCleaningCoverageAlert(cleaningAlertSummary),
    [cleaningAlertSummary]
  );

  const hasPendingCheckinsToday = checkinAlertSummary.pending > 0;
  const hasCheckinsToday = checkinAlertSummary.total > 0;
  const hasPendingPresentations = weeklyPresentationSummary.pending > 0;

  return (
    <div className="p-6 space-y-8 min-h-screen bg-base-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300">
      <h1 className="text-3xl font-bold mb-2 text-slate-900 dark:text-slate-50">
        Dashboard
      </h1>

      {/* ==== LINHA SUPERIOR: 10 KPI CARDS ==== */}
      <div>
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              checkinAlert.isPending
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
            }`}
          >
            {hasPendingCheckinsToday
              ? `Alerta: ${kpis.pendingCheckinsToday} de ${kpis.checkinsToday} check-in(s) de hoje ainda pendente(s).`
              : hasCheckinsToday
              ? `Tudo certo: ${kpis.finishedCheckinsToday} de ${kpis.checkinsToday} check-in(s) de hoje já foram feitos.`
              : "Tudo certo: não há check-ins previstos para hoje."}
          </div>

          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              hasPendingPresentations
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
            }`}
          >
            {hasPendingPresentations
              ? `Alerta: ${weeklyPresentationSummary.pending} apresentação(ões) ainda pendente(s) na semana.`
              : "Tudo certo: todas as apresentações da semana foram concluídas."}
          </div>

          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              guestCheckoutAlert.isPending
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
            }`}
          >
            {guestCheckoutAlert.message}
          </div>

          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              maidAssignmentsAlert.isPending
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
            }`}
          >
            {maidAssignmentsAlert.message}
          </div>

          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              cleaningAlert.isPending
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
            }`}
          >
            {cleaningAlert.message}
          </div>

          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              maintenanceAlert.isPending
                ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
            }`}
          >
            {maintenanceAlert.message}
          </div>
        </div>
        <DashboardKPIGrid kpis={kpis} />
      </div>

      {/* ==== LINHA: OCUPAÇÃO + MANUTENÇÃO + TOTAL ==== */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
        <div className="lg:col-span-2 h-full">
          <KpiGaugeOcupacao data={monthsTrend} />
        </div>

        <div className="lg:col-span-1 h-full">
          <KpiMaintenanceProgress maintenanceStats={maintenanceStats} isDark={isDark} />
        </div>

        <div className="lg:col-span-1 h-full">
          <KpiTotalReservas value={kpis.totalReservas + 1963} note="Inclui 1.963 reservas do PMS anterior" />
        </div>


      </div>


      {/* ==== TOP EFICIÊNCIAS (MELHOR + PIOR) ==== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Melhor Eficiência */}
        <div className="
  relative card flex-1 flex flex-col
  rounded-3xl border
  bg-gradient-to-br
  from-white via-slate-50 to-white
  dark:from-slate-950 dark:via-slate-900 dark:to-slate-950
  border-slate-200 dark:border-slate-700/60
  shadow-sm dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]
  transition-colors duration-300
  overflow-hidden
">

          {/* glow overlay premium */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 -left-20 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl dark:bg-sky-400/12" />
            <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl dark:bg-violet-400/12" />
          </div>

          <h2 className="font-semibold text-lg tracking-tight mt-6 mb-2 ml-[30%] text-slate-900 dark:text-slate-100 relative">
            📊 Acomodações com Melhor Eficiência
          </h2>

          <div className="card-body px-6 pb-6 flex flex-col lg:flex-row items-center justify-between gap-6 relative">
            {/* Top 3 visual */}
            <div className="flex flex-col items-center justify-center gap-4 w-full lg:w-[30%]">
              {topEfficiency.slice(0, 3).map((item, i) => {
                const colors = [
                  "from-yellow-400 to-yellow-300",
                  "from-gray-300 to-gray-200",
                  "from-amber-700 to-amber-600",
                ];
                const numColor =
                  i === 0
                    ? "text-yellow-500"
                    : i === 1
                      ? "text-gray-400"
                      : "text-amber-700";

                const height = i === 0 ? "h-24" : "h-20";
                const width = "w-40";
                const radius = "rounded-3xl";

                return (
                  <div key={i} className="relative flex flex-col items-center">
                    <div
                      className={`relative bg-gradient-to-br ${colors[i]} p-[3px] shadow-md ${radius} overflow-hidden`}
                    >
                      <div className="absolute inset-0 animate-shine bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                      <div
                        className={`
                    bg-white ${height} ${width} ${radius}
                    overflow-hidden flex items-center justify-center
                    dark:bg-slate-950
                  `}
                      >
                        <img
                          src={item.image || "/placeholder.jpg"}
                          alt={item.label}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.label}
                    </p>
                    <span className={`text-xs font-bold ${numColor}`}>{i + 1}º</span>
                  </div>
                );
              })}
            </div>

            {/* Gráfico Top 10 */}
            <div className="flex-grow w-full lg:w-[70%] flex items-center justify-start">
              <ResponsiveContainer width="100%" height={340}>
                <BarChart
                  data={topEfficiency.map((item, index) => ({
                    ...item,
                    posicao: `${index + 1}º`,
                  }))}
                  layout="vertical"
                  barCategoryGap={4}
                  margin={{ top: 5, right: 25, left: 10, bottom: 0 }}
                >
                  {/* ✅ defs p/ gradiente premium */}
                  <defs>
                    <linearGradient id="bestGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="55%" stopColor="#60a5fa" />
                      <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>

                    <filter id="bestGlow" x="-30%" y="-40%" width="160%" height="190%">
                      <feGaussianBlur stdDeviation="1.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    axisLine={{
                      stroke: isDark ? "#4b5563" : "#e5e7eb",
                      strokeDasharray: "3 3",
                    }}
                    tickLine={false}
                    tick={{
                      fill: isDark ? "#9ca3af" : "#6b7280",
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="posicao"
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    tick={{
                      fill: isDark ? "#e5e7eb" : "#374151",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  />
                  <RechartsTooltip
                    formatter={(v) => `${v}%`}
                    contentStyle={{
                      backgroundColor: isDark ? "#020617" : "#ffffff",
                      borderRadius: "8px",
                      border: `1px solid ${isDark ? "#1f2937" : "#e5e7eb"}`,
                      color: isDark ? "#e5e7eb" : "#111827",
                    }}
                  />

                  <Bar
                    dataKey="ocupacao"
                    radius={[0, 6, 6, 0]}
                    barSize={22}
                    isAnimationActive={false}
                  >
                    {topEfficiency.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill="url(#bestGrad)"
                        filter="url(#bestGlow)"
                      />
                    ))}

                    <LabelList
                      dataKey="label"
                      position="insideLeft"
                      style={{
                        fill: "rgba(255,255,255,0.92)",
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    />
                    <LabelList
                      dataKey="ocupacao"
                      position="right"
                      formatter={(v) => `${v}%`}
                      style={{
                        fill: isDark ? "#e5e7eb" : "#0f172a",
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Pior Eficiência */}

        <div className="
  relative card flex-1 flex flex-col
  rounded-3xl border
  bg-gradient-to-br
  from-white via-slate-50 to-white
  dark:from-slate-950 dark:via-slate-900 dark:to-slate-950
  border-slate-200 dark:border-slate-700/60
  shadow-sm dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]
  transition-colors duration-300
  overflow-hidden
">

          {/* glow overlay premium (negativo sutil) */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 -left-20 h-64 w-64 rounded-full bg-rose-500/10 blur-3xl dark:bg-rose-400/12" />
            <div className="absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-red-500/10 blur-3xl dark:bg-red-400/12" />
          </div>

          <h2 className="font-semibold text-lg tracking-tight mt-6 mb-2 ml-[30%] text-slate-900 dark:text-slate-100 relative">
            📉 Acomodações com Pior Eficiência
          </h2>

          <div className="card-body px-6 pb-6 flex flex-col lg:flex-row items-center justify-between gap-6 relative">
            {/* Piores 3 visual */}
            <div className="flex flex-col items-center justify-center gap-4 w-full lg:w-[30%]">
              {worstEfficiency.slice(0, 3).map((item, i) => {
                const colors = [
                  "from-rose-600 to-red-500",
                  "from-rose-600 to-red-500",
                  "from-rose-600 to-red-500",
                ];
                const numColor =
                  i === 0
                    ? "text-rose-500"
                    : i === 1
                      ? "text-red-400"
                      : "text-red-400";

                const height = i === 0 ? "h-24" : "h-20";
                const width = "w-40";
                const radius = "rounded-3xl";

                return (
                  <div key={i} className="relative flex flex-col items-center">
                    <div
                      className={`relative bg-gradient-to-br ${colors[i]} p-[3px] shadow-md ${radius} overflow-hidden`}
                    >
                      <div className="absolute inset-0 animate-shine bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                      <div
                        className={`
                    ${height} ${width} ${radius} overflow-hidden
                    flex items-center justify-center
                    bg-white dark:bg-slate-950
                  `}
                      >
                        <img
                          src={item.image || "/placeholder.jpg"}
                          alt={item.label}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.label}
                    </p>
                    <span className={`text-xs font-bold ${numColor}`}>{i + 1}º</span>
                  </div>
                );
              })}
            </div>

            {/* Gráfico Top 10 Piores */}
            <div className="flex-grow w-full lg:w-[70%] flex items-center justify-start">
              <ResponsiveContainer width="100%" height={340}>
                <BarChart
                  data={worstEfficiency.map((item, index) => ({
                    ...item,
                    posicao: `${index + 1}º`,
                  }))}
                  layout="vertical"
                  barCategoryGap={4}
                  margin={{ top: 5, right: 25, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="worstGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#fb7185" />
                      <stop offset="55%" stopColor="#ef4444" />
                      <stop offset="100%" stopColor="#b91c1c" />
                    </linearGradient>

                    <filter id="worstGlow" x="-30%" y="-40%" width="160%" height="190%">
                      <feGaussianBlur stdDeviation="1.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <XAxis
                    type="number"
                    domain={[0, 75]}
                    tickFormatter={(v) => `${v}%`}
                    axisLine={{
                      stroke: isDark ? "#4b5563" : "#e5e7eb",
                      strokeDasharray: "3 3",
                    }}
                    tickLine={false}
                    tick={{
                      fill: isDark ? "#9ca3af" : "#6b7280",
                      fontSize: 12,
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="posicao"
                    axisLine={false}
                    tickLine={false}
                    width={40}
                    tick={{
                      fill: isDark ? "#e5e7eb" : "#374151",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  />
                  <RechartsTooltip
                    formatter={(v) => `${v}%`}
                    contentStyle={{
                      backgroundColor: isDark ? "#020617" : "#ffffff",
                      borderRadius: "8px",
                      border: `1px solid ${isDark ? "#1f2937" : "#e5e7eb"}`,
                      color: isDark ? "#e5e7eb" : "#111827",
                    }}
                  />

                  <Bar
                    dataKey="ocupacao"
                    radius={[0, 6, 6, 0]}
                    barSize={22}
                    isAnimationActive={false}
                  >
                    {worstEfficiency.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill="url(#worstGrad)"
                        filter="url(#worstGlow)"
                      />
                    ))}
                    <LabelList
                      dataKey="label"
                      position="insideLeft"
                      style={{
                        fill: "rgba(255,255,255,0.92)",
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    />
                    <LabelList
                      dataKey="ocupacao"
                      position="right"
                      formatter={(v) => `${v}%`}
                      style={{
                        fill: isDark ? "#fecaca" : "#7f1d1d",
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>


      {/* ==== OCUPAÇÃO + DIARISTAS ==== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ocupação por empreendimento */}
        <div
          className="
    relative lg:col-span-2 overflow-hidden
    rounded-3xl border p-6
    bg-gradient-to-br
    from-white via-slate-50 to-white
    dark:from-slate-950 dark:via-slate-900 dark:to-slate-950
    border-slate-200 dark:border-slate-700/60
    shadow-sm dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]
    transition-colors duration-300
  "
        >
          {/* Glow de fundo (sutil, mesmo padrão dos outros) */}
          <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-sky-500/6 blur-3xl dark:bg-sky-400/8" />
          <div className="pointer-events-none absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-violet-500/6 blur-3xl dark:bg-violet-400/8" />

          <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
            📈 Ocupação por empreendimento{" "}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
              (média geral: {occupancy.avg}%)
            </span>
          </h2>

          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={occupancy.rows}
              barSize={52}
              margin={{ top: 10, right: 20, left: 0, bottom: 18 }}
            >
              <defs>
                {/* Gradiente principal (mesmo do resto do dash) */}
                <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="55%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>

                {/* Glow suave */}
                <filter id="occGlow" x="-30%" y="-40%" width="160%" height="190%">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* eixo X */}
              <XAxis
                dataKey="label"
                interval={0}
                height={64}
                tickMargin={14}
                tick={<StayXAxisTick isDark={isDark} />}
                axisLine={false}
                tickLine={false}
              />

              {/* eixo Y */}
              <YAxis
                domain={[0, 100]}
                type="number"
                allowDecimals={false}
                tickFormatter={(v) => `${v}%`}
                tick={{
                  fill: isDark ? "#9ca3af" : "#64748b",
                  fontSize: 12,
                }}
                axisLine={false}
                tickLine={false}
              />

              <RechartsTooltip
                formatter={(v) => `${v}%`}
                labelFormatter={(l, p) => p?.[0]?.payload?.name || l}
                contentStyle={{
                  backgroundColor: isDark ? "#020617" : "#ffffff",
                  borderRadius: "10px",
                  border: `1px solid ${isDark ? "#1f2937" : "#e5e7eb"}`,
                  color: isDark ? "#e5e7eb" : "#0f172a",
                  boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
                }}
              />

              <Bar
                dataKey="ocupacao"
                name="Ocupação (%)"
                radius={[8, 8, 0, 0]}
                fill="url(#occGrad)"
                filter="url(#occGlow)"
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>


        {/* Diaristas */}
        <div
          className="
    relative overflow-hidden
    rounded-3xl border p-6
    bg-gradient-to-br
    from-white via-slate-50 to-white
    dark:from-slate-950 dark:via-slate-900 dark:to-slate-950
    border-slate-200 dark:border-slate-700/60
    shadow-sm dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]
    transition-colors duration-300
  "
        >
          {/* Glow sutil */}
          <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-sky-500/6 blur-3xl dark:bg-sky-400/8" />
          <div className="pointer-events-none absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-violet-500/6 blur-3xl dark:bg-violet-400/8" />

          <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-slate-100">
            👥 Diaristas
          </h2>

          <DiaristaList
            title="Ativas hoje"
            data={maidsToday}
            variant="active"
            empty="Nenhuma diarista ativa hoje"
          />

          <div className="my-4 h-px bg-slate-200/70 dark:bg-slate-700/60" />

          <DiaristaList
            title="Confirmadas para amanhã"
            data={maidsTomorrow}
            variant="scheduled"
            empty="Nenhuma diarista confirmada amanhã"
          />
        </div>

      </div>

      {/* ==== AGENDAS ==== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CalendarCard
          title="Cronograma de Limpeza"
          icon={Sparkles}
          events={cleaningEvents}
          emptyText="Sem diaristas programadas"
          onSelectEvent={setSelectedCleaningEvent}
        />
        <CalendarCard
          title="Cronograma de Atividades"
          icon={ClipboardList}
          events={maintenanceEvents}
          emptyText="Sem tarefas de manutenção"
        />
      </div>
      {selectedCleaningEvent && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white dark:bg-slate-800 dark:text-slate-100 rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold mb-4">
              {selectedCleaningEvent.title}
            </h2>

            <ul className="space-y-2">
              {(selectedCleaningEvent.extendedProps?.details || []).map((d, idx) => (
                <li key={idx} className="text-slate-700 dark:text-slate-200">
                  🏨 {d}
                </li>
              ))}
            </ul>

            <div className="mt-6 text-right">
              <button
                onClick={() => setSelectedCleaningEvent(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition dark:bg-blue-500 dark:hover:bg-blue-400"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ============================
   COMPONENTES AUXILIARES
============================ */
function DiaristaList({ title, data, variant, empty }) {
  const isActive = variant === "active";

  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
        {title}
      </div>

      {Object.keys(data).length ? (
        <ul className="divide-y divide-slate-200/70 dark:divide-slate-700/60">
          {Object.entries(data).map(([nome, locais]) => {
            const initial = (nome?.trim()?.charAt(0) || "?").toUpperCase();

            const locaisFmt = locais
              .map((txt) => txt.split("–")[1]?.trim() || txt)
              .join(" | ");

            return (
              <li key={nome} className="flex items-center justify-between py-3">
                <div className="flex items-start gap-3 min-w-0">
                  {/* Avatar premium */}
                  <div
                    className={`
                      h-9 w-9 shrink-0 rounded-full grid place-items-center
                      ring-1
                      ${isActive
                        ? "bg-sky-500/10 ring-sky-400/30 text-sky-700 dark:text-sky-200"
                        : "bg-violet-500/10 ring-violet-400/30 text-violet-700 dark:text-violet-200"
                      }
                    `}
                  >
                    <span className="text-sm font-semibold">{initial}</span>
                  </div>

                  {/* Texto */}
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {nome}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                      {locaisFmt}
                    </p>
                  </div>
                </div>

                {/* Chip premium */}
                <span
                  className={`
                    ml-3 shrink-0
                    inline-flex items-center gap-1.5
                    rounded-full border px-2.5 py-1 text-xs font-semibold
                    backdrop-blur
                    ${isActive
                      ? "text-sky-700 border-sky-300/50 bg-sky-200/20 dark:text-sky-200 dark:border-sky-500/30 dark:bg-sky-500/10"
                      : "text-violet-700 border-violet-300/50 bg-violet-200/20 dark:text-violet-200 dark:border-violet-500/30 dark:bg-violet-500/10"
                    }
                  `}
                >
                  <span
                    className={`
                      h-1.5 w-1.5 rounded-full
                      ${isActive ? "bg-sky-500" : "bg-violet-500"}
                    `}
                  />
                  {isActive ? "Ativa" : "Agendada"}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-2">
          {empty}
        </p>
      )}
    </div>
  );
}


function CalendarCard({ title, events, emptyText, icon: Icon, onSelectEvent }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div
      className="
        relative overflow-hidden
        rounded-3xl border p-6
        bg-gradient-to-br
        from-white via-slate-50 to-white
        dark:from-slate-950 dark:via-slate-900 dark:to-slate-950
        border-slate-200 dark:border-slate-700/60
        shadow-sm dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]
        transition-colors duration-300
      "
    >
      {/* Glow sutil de fundo */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-sky-500/6 blur-3xl dark:bg-sky-400/8" />
      <div className="pointer-events-none absolute -bottom-24 -right-20 h-64 w-64 rounded-full bg-violet-500/6 blur-3xl dark:bg-violet-400/8" />

      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div
              className="
                h-10 w-10 rounded-xl flex items-center justify-center
                bg-gradient-to-br from-sky-400/20 to-violet-400/20
                ring-1 ring-slate-300/40
                dark:ring-slate-700/60
                text-sky-700 dark:text-sky-300
              "
            >
              <Icon size={18} />
            </div>
          )}

          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Visão semanal com todas as escalas do dia
            </p>
          </div>
        </div>

        {/* Badge lateral */}
        <div
          className="
            hidden md:flex items-center gap-2
            text-xs rounded-full px-3 py-1 border
            bg-slate-50 border-slate-200 text-slate-600
            dark:bg-slate-900/70 dark:border-slate-700 dark:text-slate-300
          "
        >
          <span className="w-2 h-2 rounded-full bg-sky-500" />
          <span>Eventos confirmados</span>
        </div>
      </div>

      {/* CALENDÁRIO */}
      <div
        className="
          rounded-2xl overflow-hidden border
          bg-white border-slate-200
          dark:bg-slate-950 dark:border-slate-800
        "
      >
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridWeek"
          locale="pt-br"
          events={events}
          height={480}
          dayMaxEvents={false}
          fixedWeekCount={false}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,dayGridWeek,timeGridDay",
          }}
          buttonText={{
            today: "Hoje",
            month: "Mês",
            week: "Semana",
            day: "Dia",
          }}
          viewDidMount={(arg) => {
            const toolbar = arg.el.querySelector(".fc-header-toolbar");
            if (!toolbar) return;

            const titleEl = toolbar.querySelector(".fc-toolbar-title");
            if (titleEl) {
              titleEl.classList.add(
                "text-sm",
                "font-semibold",
                isDark ? "text-slate-100" : "text-slate-800"
              );
            }

            toolbar.querySelectorAll("button").forEach((btn) => {
              btn.classList.add(
                "rounded-lg",
                "px-3",
                "py-1.5",
                "text-xs",
                "font-medium",
                "transition-all",
                "border",
                "focus:outline-none",
                "focus:ring-2"
              );

              if (isDark) {
                btn.classList.add(
                  "bg-slate-900",
                  "border-slate-700",
                  "text-slate-100",
                  "hover:bg-slate-800"
                );
              } else {
                btn.classList.add(
                  "bg-slate-50",
                  "border-slate-300",
                  "text-slate-800",
                  "hover:bg-slate-100"
                );
              }
            });
          }}
          dayHeaderClassNames={() =>
            isDark
              ? "bg-slate-900 text-slate-300 text-xs border-b border-slate-800"
              : "bg-slate-50 text-slate-600 text-xs border-b border-slate-200"
          }
          dayCellClassNames={() =>
            "text-xs " +
            (isDark
              ? "border-slate-900 hover:bg-slate-900/60"
              : "border-slate-100 hover:bg-slate-50")
          }
          eventClassNames={() => "border-0"}
          eventContent={(arg) => {
            const isNoEvent =
              arg.event.title === "Sem diarista" || arg.event.extendedProps?.tipo === "sem_diarista";


            const base =
              "px-2 py-1 rounded-md text-[11px] font-semibold shadow-sm truncate";

            const style = isDark
              ? isNoEvent
                ? {
                  background:
                    "linear-gradient(135deg,#7f1d1d,#b91c1c)",
                  color: "#fee2e2",
                }
                : {
                  background:
                    "linear-gradient(135deg,#1d4ed8,#38bdf8)",
                  color: "#ecfeff",
                }
              : isNoEvent
                ? {
                  background:
                    "linear-gradient(135deg,#fee2e2,#fecaca)",
                  color: "#ea2929ff",
                }
                : {
                  background:
                    "linear-gradient(135deg,#bfdbfe,#60a5fa)",
                  color: "#b90d0dff",
                };

            return (
              <div
                className={base + (onSelectEvent ? " cursor-pointer" : "")}
                style={style}
                title={arg.event.title}
                onClick={() => onSelectEvent?.(arg.event)}
                role={onSelectEvent ? "button" : undefined}
                tabIndex={onSelectEvent ? 0 : undefined}
                onKeyDown={(e) => {
                  if (!onSelectEvent) return;
                  if (e.key === "Enter" || e.key === " ") onSelectEvent(arg.event);
                }}
              >
                {arg.event.title}
              </div>
            );

          }}
          contentHeight="auto"
          dayHeaderFormat={{ weekday: "short" }}
        />
      </div>

      {!events?.length && (
        <div className="mt-4 text-center text-sm">
          <div
            className="
              inline-flex items-center gap-2 px-4 py-2 rounded-full border
              bg-slate-50 border-slate-200 text-slate-500
              dark:bg-slate-900/70 dark:border-slate-700 dark:text-slate-400
            "
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>{emptyText}</span>
          </div>
        </div>
      )}

    </div>

  );
}
