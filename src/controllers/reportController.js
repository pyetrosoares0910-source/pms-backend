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
    const startOfMonth = dayjs(`${year}-${monthPadded}-01`).startOf("day");
    const endExclusive = startOfMonth.add(1, "month"); // fim exclusivo

    const stays = await prisma.stay.findMany({
      include: {
        rooms: {
          where: { active: true }, // ✅ já estava
          include: { reservations: true },
          orderBy: { position: "asc" },
        },
      },
    });

    // ✅ remove stays que ficaram sem rooms ativos
    const staysFiltered = stays.filter((s) => (s.rooms?.length ?? 0) > 0);

    const result = staysFiltered.map((stay) => {
      let totalOccupiedDays = 0;
      let totalDaysAvailable = 0;
      let totalReservations = 0;

      const roomsData = stay.rooms.map((room) => {
        let occupiedDays = 0;

        room.reservations.forEach((res) => {
          if (!res.checkinDate || !res.checkoutDate) return;

          // 🧩 ignora canceladas logo aqui
          if (
            res.status &&
            ["CANCELADA", "CANCELLED", "CANCELED"].includes(
              String(res.status).toUpperCase()
            )
          ) {
            return;
          }

          const checkIn = dayjs(res.checkinDate);
          const checkOut = dayjs(res.checkoutDate);
          if (!checkIn.isValid() || !checkOut.isValid()) return;
          if (checkOut.isBefore(checkIn)) return;

          // ignora reservas fora do mês
          if (checkOut.isSameOrBefore(startOfMonth) || checkIn.isSameOrAfter(endExclusive)) return;

          // calcula o período sobreposto ao mês
          const start = checkIn.isBefore(startOfMonth) ? startOfMonth : checkIn;
          const end = checkOut.isAfter(endExclusive) ? endExclusive : checkOut;

          const diffDays = end.diff(start, "day");
          if (diffDays > 0 && diffDays < 100) {
            occupiedDays += diffDays;
          }
        });

        const daysInMonth = endExclusive.diff(startOfMonth, "day");
        const vazio = Math.max(0, daysInMonth - occupiedDays);

        totalOccupiedDays += occupiedDays;
        totalDaysAvailable += daysInMonth;

        // ⚙️ ajusta aqui também o total geral (ignora canceladas)
        const validReservations = room.reservations.filter((res) => {
          if (!res.checkinDate || !res.checkoutDate) return false;
          if (
            res.status &&
            ["CANCELADA", "CANCELLED", "CANCELED"].includes(
              String(res.status).toUpperCase()
            )
          )
            return false;

          const ci = dayjs(res.checkinDate);
          const co = dayjs(res.checkoutDate);
          if (!ci.isValid() || !co.isValid()) return false;
          if (co.isBefore(ci)) return false;

          return !(co.isSameOrBefore(startOfMonth) || ci.isSameOrAfter(endExclusive));
        });

        totalReservations += validReservations.length;

        return {
          title: room.title,
          ocupado: occupiedDays,
          vazio,
          ocupacao: ((occupiedDays / daysInMonth) * 100).toFixed(0),
          reservas: validReservations.length,
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
          where: { active: true }, // ✅ já estava
          include: { reservations: true },
          orderBy: { position: "asc" },
        },
      },
    });

    // ✅ remove stays que ficaram sem rooms ativos
    const staysFiltered = stays.filter((s) => (s.rooms?.length ?? 0) > 0);

    const result = staysFiltered.map((stay) => {
      let totalAnualDiarias = 0;
      let totalAnualDisponiveis = 0;

      const months = Array.from({ length: 12 }, (_, i) => i + 1);

      const dadosMensais = months.map((month) => {
        const monthPadded = String(month).padStart(2, "0");
        const startOfMonth = dayjs(`${year}-${monthPadded}-01`).startOf("day");
        const endExclusive = startOfMonth.add(1, "month");


        let totalOccupiedDays = 0;
        let totalDaysAvailable = 0;

        stay.rooms.forEach((room) => {
          const daysInMonth = endExclusive.diff(startOfMonth, "day");
          totalDaysAvailable += daysInMonth;

          room.reservations.forEach((res) => {
            if (!res.checkinDate || !res.checkoutDate) return;

            if (
              res.status &&
              ["CANCELADA", "CANCELLED", "CANCELED"].includes(
                String(res.status).toUpperCase()
              )
            ) {
              return;
            }

            const checkIn = dayjs(res.checkinDate);
            const checkOut = dayjs(res.checkoutDate);
            if (!checkIn.isValid() || !checkOut.isValid()) return;
            if (checkOut.isBefore(checkIn)) return;

            if (checkOut.isSameOrBefore(startOfMonth) || checkIn.isSameOrAfter(endExclusive)) return;

            const start = checkIn.isBefore(startOfMonth) ? startOfMonth : checkIn;
            const end = checkOut.isAfter(endExclusive) ? endExclusive : checkOut;

            const noites = end.diff(start, "day");
            if (noites > 0 && noites < 100) {
              totalOccupiedDays += noites;
            }
          });
        });

        const ocupacao = totalDaysAvailable
          ? ((totalOccupiedDays / totalDaysAvailable) * 100).toFixed(0)
          : "0";

        totalAnualDiarias += totalOccupiedDays;
        totalAnualDisponiveis += totalDaysAvailable;

        return { mes: month, ocupacao };
      });

      const ocupacaoMediaAnual = totalAnualDisponiveis
        ? ((totalAnualDiarias / totalAnualDisponiveis) * 100).toFixed(0)
        : "0";

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
