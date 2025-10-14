const { PrismaClient } = require("@prisma/client");
const dayjs = require("dayjs");

const prisma = new PrismaClient();

/* ============================================
   📅 RELATÓRIO MENSAL DE DESEMPENHO
   ============================================ */
async function getMonthlyPerformance(req, res) {
  try {
    const { month, year } = req.query;
    if (!month || !year)
      return res
        .status(400)
        .json({ error: "Informe mês e ano, ex: ?month=9&year=2025" });

    const monthPadded = String(month).padStart(2, "0");
    const startOfMonth = dayjs(`${year}-${monthPadded}-01`).startOf("month");
    const endOfMonth = startOfMonth.endOf("month");

    const stays = await prisma.stay.findMany({
      include: {
        rooms: {
          include: { reservations: true },
        },
      },
    });

    const result = stays.map((stay) => {
      let totalOccupiedDays = 0;
      let totalDaysAvailable = 0;
      let totalReservations = 0;

      const roomsData = stay.rooms.map((room) => {
  let occupiedDays = 0;

  room.reservations.forEach((res) => {
    if (!res.checkinDate || !res.checkoutDate) return;

    const checkIn = dayjs(res.checkinDate);
    const checkOut = dayjs(res.checkoutDate);
    if (!checkIn.isValid() || !checkOut.isValid()) return;
    if (checkOut.isBefore(checkIn)) return;

    // ignora reservas fora do mês
    if (checkOut.isBefore(startOfMonth) || checkIn.isAfter(endOfMonth)) return;

    // calcula o período sobreposto ao mês
    const start = checkIn.isBefore(startOfMonth) ? startOfMonth : checkIn;
    const end = checkOut.isAfter(endOfMonth) ? endOfMonth : checkOut;

    const diffDays = end.diff(start, "day");
    if (diffDays > 0 && diffDays < 100) {
      occupiedDays += diffDays;
    }
  });

  const daysInMonth = endOfMonth.diff(startOfMonth, "day") + 1;
  const vazio = Math.max(0, daysInMonth - occupiedDays);

  totalOccupiedDays += occupiedDays;
  totalDaysAvailable += daysInMonth;
  totalReservations += room.reservations.length;

  return {
    title: room.title,
    ocupado: occupiedDays,
    vazio,
    ocupacao: ((occupiedDays / daysInMonth) * 100).toFixed(0),
    reservas: room.reservations.length, 
  };
});


      const ocupacaoMedia =
        totalDaysAvailable > 0
          ? ((totalOccupiedDays / totalDaysAvailable) * 100).toFixed(0)
          : "0";

      return {
        stayName: stay.name,
        totalDiarias: totalOccupiedDays,
        ocupacaoMedia,
        totalReservas: totalReservations,
        rooms: roomsData,
      };
    });

    res.json({
      month: parseInt(month),
      year: parseInt(year),
      stays: result,
    });
  } catch (err) {
    console.error("❌ Erro em getMonthlyPerformance:", err);
    res.status(500).json({
      error: "Erro ao gerar relatório de desempenho mensal",
      details: err.message,
    });
  }
}

/* ============================================
   📆 RELATÓRIO ANUAL DE DESEMPENHO
   ============================================ */
async function getAnnualPerformance(req, res) {
  try {
    const { year } = req.query;
    if (!year)
      return res
        .status(400)
        .json({ error: "Informe o ano, ex: ?year=2025" });

    const stays = await prisma.stay.findMany({
      include: {
        rooms: {
          include: {
            reservations: true,
          },
        },
      },
    });

    const result = stays.map((stay) => {
      let totalAnualDiarias = 0;
      let totalAnualDisponiveis = 0;

      const months = Array.from({ length: 12 }, (_, i) => i + 1);

      const dadosMensais = months.map((month) => {
        const monthPadded = String(month).padStart(2, "0");
        const startOfMonth = dayjs(`${year}-${monthPadded}-01`).startOf("month");
        const endOfMonth = startOfMonth.endOf("month");

        let totalOccupiedDays = 0;
        let totalDaysAvailable = 0;

        stay.rooms.forEach((room) => {
          const daysInMonth = endOfMonth.diff(startOfMonth, "day") + 1;
          totalDaysAvailable += daysInMonth;

          room.reservations.forEach((res) => {
            if (!res.checkinDate || !res.checkoutDate) return;

            const checkIn = dayjs(res.checkinDate);
            const checkOut = dayjs(res.checkoutDate);

            if (!checkIn.isValid() || !checkOut.isValid()) return;
            if (checkOut.isBefore(checkIn)) return;

            // interseção com o mês
            if (checkOut.isBefore(startOfMonth) || checkIn.isAfter(endOfMonth))
              return;

            const start = checkIn.isBefore(startOfMonth)
              ? startOfMonth
              : checkIn;
            const end = checkOut.isAfter(endOfMonth) ? endOfMonth : checkOut;

            const dias = end.diff(start, "day") + 1;
            if (dias > 0 && dias < 100) {
              totalOccupiedDays += dias;
            }
          });
        });

        const ocupacao = totalDaysAvailable
          ? ((totalOccupiedDays / totalDaysAvailable) * 100).toFixed(0)
          : "0";

        totalAnualDiarias += totalOccupiedDays;
        totalAnualDisponiveis += totalDaysAvailable;

        return {
          mes: month,
          ocupacao,
        };
      });

      const ocupacaoMediaAnual = (
  dadosMensais.reduce((acc, m) => acc + Number(m.ocupacao), 0) / dadosMensais.length
).toFixed(0);


      return {
        stayName: stay.name,
        year: parseInt(year),
        ocupacaoMediaAnual,
        meses: dadosMensais,
      };
    });

    res.json({
      year: parseInt(year),
      stays: result,
    });
  } catch (err) {
    console.error("❌ Erro em getAnnualPerformance:", err);
    res.status(500).json({
      error: "Erro ao gerar relatório anual",
      details: err.message,
    });
  }
}

module.exports = { getMonthlyPerformance, getAnnualPerformance };
