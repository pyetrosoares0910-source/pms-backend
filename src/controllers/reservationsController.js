const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// GET /reservations
async function getAllReservations(req, res) {
  try {
    const reservations = await prisma.reservation.findMany({
      include: {
        room: { include: { stay: true } },
        guest: true,
      },
      orderBy: { checkinDate: "asc" },
    });

    return res.json(reservations);
  } catch (error) {
    console.error("Erro ao listar reservas:", error);
    return res.status(500).json({ error: "Erro ao listar reservas." });
  }
}

// GET /reservations/:id
async function getReservationById(req, res) {
  const { id } = req.params;
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: String(id) },
      include: {
        room: { include: { stay: true } },
        guest: true,
      },
    });

    if (!reservation) {
      return res.status(404).json({ error: "Reserva não encontrada." });
    }

    return res.json(reservation);
  } catch (error) {
    console.error("Erro ao buscar reserva:", error);
    return res.status(500).json({ error: "Erro ao buscar reserva." });
  }
}

// POST /reservations
async function createReservation(req, res) {
  const { roomId, guestId, checkinDate, checkoutDate, status, notes } = req.body;

  try {
    // 🔹 Verifica conflito de datas no mesmo quarto (exceto reservas canceladas)
    const overlapping = await prisma.reservation.findFirst({
      where: {
        roomId: roomId,
        status: { not: "cancelada" },
        AND: [
          { checkinDate: { lt: new Date(checkoutDate) } }, // começa antes do checkout
          { checkoutDate: { gt: new Date(checkinDate) } }, // termina depois do checkin
        ],
      },
    });

    if (overlapping) {
      return res.status(400).json({
        error:
          "Já existe uma reserva ativa ou agendada neste período para esta acomodação.",
      });
    }

    // 🔹 Cria a reserva
    const reservation = await prisma.reservation.create({
      data: {
        roomId: roomId ? String(roomId) : null,
        guestId: guestId ? String(guestId) : null,
        checkinDate: new Date(checkinDate),
        checkoutDate: new Date(checkoutDate),
        status,
        notes: notes || null,
      },
      include: {
        room: { include: { stay: true } },
        guest: true,
      },
    });

    // 🔹 Cria a Task correspondente ao checkout
    await prisma.task.create({
      data: {
        date: reservation.checkoutDate,
        stay: reservation.room?.stay?.name || "Sem Stay",
        rooms: reservation.room?.title || "Sem identificação",
      },
    });

    return res.status(201).json(reservation);
  } catch (error) {
    if (error.code === "P2003") {
      return res.status(400).json({
        error:
          "guestId ou roomId inválido — verifique se o hóspede e o quarto existem.",
      });
    }
    console.error("Erro ao criar reserva:", error);
    return res.status(500).json({ error: "Erro ao criar reserva." });
  }
}

// PUT /reservations/:id
async function updateReservation(req, res) {
  try {
    const { id } = req.params;
    const { roomId, guestId, checkinDate, checkoutDate, status, notes } = req.body;

    const updated = await prisma.reservation.update({
      where: { id: String(id) },
      data: {
        roomId: roomId !== undefined ? String(roomId) : undefined,
        guestId: guestId !== undefined ? String(guestId) : undefined,
        checkinDate: checkinDate ? new Date(checkinDate) : undefined,
        checkoutDate: checkoutDate ? new Date(checkoutDate) : undefined,
        status,
        notes,
      },
      include: {
        room: { include: { stay: true } },
        guest: true,
      },
    });

    // 🔹 Atualiza ou cria Task vinculada
    const existingTask = await prisma.task.findFirst({
      where: {
        date: updated.checkoutDate,
        stay: updated.room.stay.name,
        rooms: updated.room.title,
      },
    });

    if (existingTask) {
      await prisma.task.update({
        where: { id: existingTask.id },
        data: {
          date: updated.checkoutDate,
          stay: updated.room?.stay?.name || "Sem Stay",
          rooms: updated.room?.title || "Sem identificação",
        },
      });
    } else {
      await prisma.task.create({
        data: {
          date: updated.checkoutDate,
          stay: updated.room.stay.name,
          rooms: updated.room.title,
        },
      });
    }

    return res.json(updated);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Reserva não encontrada." });
    }
    console.error("Erro ao atualizar reserva:", err);
    return res.status(500).json({ error: "Erro interno ao atualizar reserva." });
  }
}

// DELETE /reservations/:id
async function deleteReservation(req, res) {
  const { id } = req.params;

  try {
    const deleted = await prisma.reservation.delete({
      where: { id: String(id) },
      include: { room: { include: { stay: true } } },
    });

    // 🔹 Remove a Task correspondente
    await prisma.task.deleteMany({
      where: {
        date: deleted.checkoutDate,
        stay: deleted.room.stay.name,
        rooms: deleted.room.title,
      },
    });

    return res.json({
      message: "Reserva e tarefa de limpeza removidas com sucesso.",
    });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Reserva não encontrada." });
    }
    console.error("Erro ao deletar reserva:", err);
    return res.status(500).json({ error: "Erro interno ao deletar reserva." });
  }
}

module.exports = {
  getAllReservations,
  getReservationById,
  createReservation,
  updateReservation,
  deleteReservation,
};
