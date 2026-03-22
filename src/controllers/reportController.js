const { PrismaClient } = require("@prisma/client");
const dayjs = require("dayjs");

const prisma = new PrismaClient();

function getMonthRange(year, month) {
  const monthPadded = String(month).padStart(2, "0");
  const start = dayjs(`${year}-${monthPadded}-01`).startOf("month");
  const end = start.add(1, "month");

  return {
    start,
    end,
    daysInMonth: end.diff(start, "day"),
  };
}

function getOverlapDays(a0, a1, b0, b1) {
  const left = dayjs(a0);
  const right = dayjs(a1);
  const periodStart = dayjs(b0);
  const periodEnd = dayjs(b1);

  const start = left.isAfter(periodStart) ? left : periodStart;
  const end = right.isBefore(periodEnd) ? right : periodEnd;
  const diff = end.diff(start, "day");

  return Math.max(0, diff);
}

function isCanceledReservation(reservation) {
  return (
    reservation?.status &&
    ["CANCELADA", "CANCELLED", "CANCELED"].includes(
      String(reservation.status).toUpperCase()
    )
  );
}

function getRoomAvailableDays(room, start, end) {
  const roomStart = room?.createdAt
    ? dayjs(room.createdAt).startOf("day")
    : dayjs(start);

  return getOverlapDays(roomStart, end, start, end);
}

async function fetchActiveStaysWithRooms() {
  const stays = await prisma.stay.findMany({
    include: {
      rooms: {
        where: { active: true },
        include: { reservations: true },
        orderBy: { position: "asc" },
      },
    },
  });

  return stays.filter((stay) => (stay.rooms?.length ?? 0) > 0);
}

function buildMonthlyStayData(stay, startOfMonth, endOfMonth) {
  let totalOccupiedDays = 0;
  let totalDaysAvailable = 0;
  let totalReservations = 0;

  const rooms = (stay.rooms || [])
    .map((room) => {
      const availableDays = getRoomAvailableDays(room, startOfMonth, endOfMonth);
      if (availableDays <= 0) return null;

      let occupiedDays = 0;

      (room.reservations || []).forEach((reservation) => {
        if (!reservation.checkinDate || !reservation.checkoutDate) return;
        if (isCanceledReservation(reservation)) return;

        const checkIn = dayjs(reservation.checkinDate);
        const checkOut = dayjs(reservation.checkoutDate);
        if (!checkIn.isValid() || !checkOut.isValid()) return;
        if (checkOut.isBefore(checkIn)) return;

        const overlapDays = getOverlapDays(
          checkIn,
          checkOut,
          startOfMonth,
          endOfMonth
        );

        if (overlapDays > 0 && overlapDays < 100) {
          occupiedDays += overlapDays;
        }
      });

      const validReservations = (room.reservations || []).filter((reservation) => {
        if (!reservation.checkinDate || !reservation.checkoutDate) return false;
        if (isCanceledReservation(reservation)) return false;

        const checkIn = dayjs(reservation.checkinDate);
        const checkOut = dayjs(reservation.checkoutDate);
        if (!checkIn.isValid() || !checkOut.isValid()) return false;
        if (checkOut.isBefore(checkIn)) return false;

        return getOverlapDays(checkIn, checkOut, startOfMonth, endOfMonth) > 0;
      });

      const vacantDays = Math.max(0, availableDays - occupiedDays);

      totalOccupiedDays += occupiedDays;
      totalDaysAvailable += availableDays;
      totalReservations += validReservations.length;

      return {
        id: room.id,
        title: room.title,
        capacidade: availableDays,
        ocupado: occupiedDays,
        vazio: vacantDays,
        ocupacao: ((occupiedDays / availableDays) * 100).toFixed(0),
        reservas: validReservations.length,
      };
    })
    .filter(Boolean);

  return {
    stayName: stay.name,
    totalDiarias: totalOccupiedDays,
    capacidadeTotal: totalDaysAvailable,
    ocupacaoMedia:
      totalDaysAvailable > 0
        ? ((totalOccupiedDays / totalDaysAvailable) * 100).toFixed(0)
        : "0",
    totalReservas: totalReservations,
    rooms,
  };
}

async function getMonthlyPerformance(req, res) {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res
        .status(400)
        .json({ error: "Informe mes e ano, ex: ?month=9&year=2025" });
    }

    const { start: startOfMonth, end: endOfMonth } = getMonthRange(year, month);
    const stays = await fetchActiveStaysWithRooms();

    const result = stays
      .map((stay) => buildMonthlyStayData(stay, startOfMonth, endOfMonth))
      .filter((stay) => stay.capacidadeTotal > 0);

    res.json({
      month: parseInt(month, 10),
      year: parseInt(year, 10),
      stays: result,
    });
  } catch (err) {
    console.error("Erro em getMonthlyPerformance:", err);
    res.status(500).json({
      error: "Erro ao gerar relatorio de desempenho mensal",
      details: err.message,
    });
  }
}

async function getAnnualPerformance(req, res) {
  try {
    const { year } = req.query;

    if (!year) {
      return res.status(400).json({ error: "Informe o ano, ex: ?year=2025" });
    }

    const stays = await fetchActiveStaysWithRooms();

    const result = stays
      .map((stay) => {
        let totalAnualDiarias = 0;
        let totalAnualDisponiveis = 0;

        const meses = Array.from({ length: 12 }, (_, index) => index + 1).map((month) => {
          const { start: startOfMonth, end: endOfMonth } = getMonthRange(year, month);

          let totalOccupiedDays = 0;
          let totalDaysAvailable = 0;

          (stay.rooms || []).forEach((room) => {
            const availableDays = getRoomAvailableDays(room, startOfMonth, endOfMonth);
            if (availableDays <= 0) return;

            totalDaysAvailable += availableDays;

            (room.reservations || []).forEach((reservation) => {
              if (!reservation.checkinDate || !reservation.checkoutDate) return;
              if (isCanceledReservation(reservation)) return;

              const checkIn = dayjs(reservation.checkinDate);
              const checkOut = dayjs(reservation.checkoutDate);
              if (!checkIn.isValid() || !checkOut.isValid()) return;
              if (checkOut.isBefore(checkIn)) return;

              const overlapDays = getOverlapDays(
                checkIn,
                checkOut,
                startOfMonth,
                endOfMonth
              );

              if (overlapDays > 0 && overlapDays < 100) {
                totalOccupiedDays += overlapDays;
              }
            });
          });

          totalAnualDiarias += totalOccupiedDays;
          totalAnualDisponiveis += totalDaysAvailable;

          return {
            mes: month,
            ocupacao: totalDaysAvailable
              ? ((totalOccupiedDays / totalDaysAvailable) * 100).toFixed(0)
              : "0",
          };
        });

        return {
          stayName: stay.name,
          year: parseInt(year, 10),
          ocupacaoMediaAnual: totalAnualDisponiveis
            ? ((totalAnualDiarias / totalAnualDisponiveis) * 100).toFixed(0)
            : "0",
          meses,
          capacidadeTotal: totalAnualDisponiveis,
        };
      })
      .filter((stay) => stay.capacidadeTotal > 0);

    res.json({
      year: parseInt(year, 10),
      stays: result,
    });
  } catch (err) {
    console.error("Erro em getAnnualPerformance:", err);
    res.status(500).json({
      error: "Erro ao gerar relatorio anual",
      details: err.message,
    });
  }
}

module.exports = { getMonthlyPerformance, getAnnualPerformance };
