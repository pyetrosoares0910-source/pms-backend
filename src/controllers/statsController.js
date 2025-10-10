const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// GET /stats/overview
exports.overviewStats = async (req, res) => {
  try {
    const total = await prisma.reservation.count();

    const activeRooms = await prisma.room.count({ where: { active: true } });

    const occupancyRaw = await prisma.reservation.findMany({
      where: { status: { in: ["agendada", "ativa", "concluida"] } },
      select: {
        checkinDate: true,
        checkoutDate: true,
      },
    });

    let totalNights = 0;
    let estadias = 0;

    for (let resv of occupancyRaw) {
      const checkin = new Date(resv.checkinDate);
      const checkout = new Date(resv.checkoutDate);
      const diff = (checkout - checkin) / (1000 * 60 * 60 * 24);
      if (!isNaN(diff) && diff > 0) {
        totalNights += diff;
        estadias++;
      }
    }

    const tempoMedioEstadia = estadias > 0 ? (totalNights / estadias).toFixed(2) : 0;

    res.json({
      totalReservas: total,
      tempoMedioEstadia,
      noitesReservadas: totalNights,
      quartosAtivos: activeRooms,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// GET /stats/ranking
exports.mostUsedRooms = async (req, res) => {
  try {
    const ranking = await prisma.reservation.groupBy({
      by: ["roomId"],
      _count: {
        roomId: true,
      },
      orderBy: {
        _count: {
          roomId: "desc",
        },
      },
    });

    const withRoomInfo = await Promise.all(
      ranking.map(async (r) => {
        const room = await prisma.room.findUnique({ where: { id: r.roomId } });
        return {
          roomId: r.roomId,
          nome: room?.name || "(desconhecida)",
          reservas: r._count.roomId,
        };
      })
    );

    res.json(withRoomInfo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// GET /stats/cancelamentos
exports.cancelRate = async (req, res) => {
  try {
    const total = await prisma.reservation.count();
    const canceladas = await prisma.reservation.count({
      where: { status: "cancelada" },
    });

    const taxa = total === 0 ? 0 : ((canceladas / total) * 100).toFixed(2);

    res.json({
      totalReservas: total,
      canceladas,
      taxaCancelamento: `${taxa}%`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// GET /stats/ocupacao
exports.occupancyRate = async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const reservas = await prisma.reservation.findMany({
      where: {
        AND: [
          { checkinDate: { lte: endOfMonth } },
          { checkoutDate: { gte: startOfMonth } },
        ],
      },
    });

    let diasReservados = 0;

    for (const reserva of reservas) {
      const checkin = new Date(reserva.checkinDate) < startOfMonth ? startOfMonth : new Date(reserva.checkinDate);
      const checkout = new Date(reserva.checkoutDate) > endOfMonth ? endOfMonth : new Date(reserva.checkoutDate);

      const diff = (checkout - checkin) / (1000 * 60 * 60 * 24);
      if (!isNaN(diff) && diff > 0) {
        diasReservados += diff;
      }
    }

    const totalQuartos = await prisma.room.count();
    const diasNoMes = endOfMonth.getDate(); // número total de dias no mês
    const diasPossiveis = totalQuartos * diasNoMes;

    const taxaOcupacao = diasPossiveis > 0 ? ((diasReservados / diasPossiveis) * 100).toFixed(2) : '0.00';

    res.json({
      diasReservados,
      diasPossiveis,
      taxaOcupacao: `${taxaOcupacao}%`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
