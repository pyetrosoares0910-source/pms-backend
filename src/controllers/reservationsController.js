const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const STATUS_CANCELADA = "cancelada";
const DEFAULT_STATUS = "registrada";

function makeHttpError(status, message, details = null) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function normalizeStatus(value, fallback = DEFAULT_STATUS) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized || fallback;
}

function normalizeTaskText(value, fallback) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || fallback;
}

function toValidDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function getUtcDayRange(value) {
  const parsed = toValidDate(value);
  if (!parsed) {
    return { day: null, start: null, end: null };
  }

  const day = parsed.toISOString().slice(0, 10);
  return {
    day,
    start: new Date(`${day}T00:00:00.000Z`),
    end: new Date(`${day}T23:59:59.999Z`),
  };
}

function isSameUtcDay(a, b) {
  const dayA = getUtcDayRange(a).day;
  const dayB = getUtcDayRange(b).day;
  return Boolean(dayA && dayB && dayA === dayB);
}

function getTaskScopeFromReservation(reservation) {
  const cleaningDate = reservation.cleaningDateOverride || reservation.checkoutDate;
  const { start, end } = getUtcDayRange(cleaningDate);
  return {
    start,
    end,
    date: start,
    stay: normalizeTaskText(reservation.room?.stay?.name, "Sem Stay"),
    rooms: normalizeTaskText(reservation.room?.title, "Sem identificacao"),
  };
}

function getTaskWhereByRoomScope(scope) {
  return {
    date: { gte: scope.start, lte: scope.end },
    rooms: scope.rooms,
  };
}

function getTaskScopeKey(scope) {
  const day = scope.date?.toISOString?.().slice(0, 10) || "sem-data";
  return [day, scope.rooms].join("|");
}

function pickTaskToKeep(tasks) {
  return tasks.find((task) => task.maidId !== null && task.maidId !== undefined) || tasks[0];
}

async function ensureSingleCheckoutTask(tx, scope) {
  const tasks = await tx.task.findMany({
    where: getTaskWhereByRoomScope(scope),
    orderBy: { id: "asc" },
  });

  if (tasks.length === 0) {
    return tx.task.create({
      data: {
        date: scope.date,
        stay: scope.stay,
        rooms: scope.rooms,
      },
    });
  }

  const keep = pickTaskToKeep(tasks);
  const duplicateIds = tasks.filter((task) => task.id !== keep.id).map((task) => task.id);

  if (duplicateIds.length > 0) {
    await tx.task.deleteMany({
      where: { id: { in: duplicateIds } },
    });
  }

  const keepInSync =
    !isSameUtcDay(keep.date, scope.date) || keep.stay !== scope.stay || keep.rooms !== scope.rooms;

  if (!keepInSync) {
    return keep;
  }

  return tx.task.update({
    where: { id: keep.id },
    data: {
      date: scope.date,
      stay: scope.stay,
      rooms: scope.rooms,
    },
  });
}

async function hasAssignedMaidInScope(tx, scope) {
  const assignedTask = await tx.task.findFirst({
    where: {
      ...getTaskWhereByRoomScope(scope),
      maidId: { not: null },
    },
    select: { id: true },
  });

  return Boolean(assignedTask);
}

async function getAssignedMaidConflictDetails(tx, scope, reservation) {
  const assignedTask = await tx.task.findFirst({
    where: {
      ...getTaskWhereByRoomScope(scope),
      maidId: { not: null },
    },
    include: { maid: true },
  });

  if (!assignedTask?.maidId) return null;

  const sameDayTasks = await tx.task.findMany({
    where: {
      date: { gte: scope.start, lte: scope.end },
      maidId: assignedTask.maidId,
    },
    include: { maid: true },
    orderBy: [{ stay: "asc" }, { rooms: "asc" }],
  });

  const rooms = await tx.room.findMany({
    include: { stay: true },
  });
  const roomsByTitle = new Map(rooms.map((room) => [room.title, room]));

  const reservations = await tx.reservation.findMany({
    where: {
      status: { not: STATUS_CANCELADA },
      OR: [
        { cleaningDateOverride: { gte: scope.start, lte: scope.end } },
        {
          cleaningDateOverride: null,
          checkoutDate: { gte: scope.start, lte: scope.end },
        },
      ],
    },
    include: {
      guest: true,
      room: { include: { stay: true } },
    },
  });
  const reservationsByRoomId = new Map(reservations.map((item) => [item.roomId, item]));

  return {
    code: "ASSIGNED_MAID_CONFLICT",
    reservationId: reservation.id,
    date: scope.date?.toISOString?.().slice(0, 10) || null,
    maid: assignedTask.maid
      ? {
          id: assignedTask.maid.id,
          name: assignedTask.maid.name,
          bank: assignedTask.maid.bank,
          pixKey: assignedTask.maid.pixKey,
        }
      : null,
    task: {
      id: assignedTask.id,
      stay: assignedTask.stay,
      rooms: assignedTask.rooms,
      maidId: assignedTask.maidId,
    },
    sameDayAssignments: sameDayTasks.map((task) => {
      const room = roomsByTitle.get(task.rooms);
      const matchedReservation = room ? reservationsByRoomId.get(room.id) : null;
      return {
        taskId: task.id,
        stay: task.stay,
        rooms: task.rooms,
        reservationId: matchedReservation?.id || null,
        guestName: matchedReservation?.guest?.name || null,
        isCurrentReservation: task.id === assignedTask.id,
      };
    }),
    isOnlyAssignmentForMaidThatDay: sameDayTasks.length <= 1,
  };
}

async function syncOldScopeAfterReservationChange(
  tx,
  { reservationIdToIgnore, roomId, effectiveCleaningDate, oldScope }
) {
  const { start, end } = getUtcDayRange(effectiveCleaningDate);

  const anotherReservationOnSameDay = await tx.reservation.findFirst({
    where: {
      id: { not: reservationIdToIgnore },
      roomId: String(roomId),
      status: { not: STATUS_CANCELADA },
      OR: [
        { cleaningDateOverride: { gte: start, lte: end } },
        {
          cleaningDateOverride: null,
          checkoutDate: { gte: start, lte: end },
        },
      ],
    },
    select: { id: true },
  });

  if (anotherReservationOnSameDay) {
    await ensureSingleCheckoutTask(tx, oldScope);
    return;
  }

  await tx.task.deleteMany({
    where: getTaskWhereByRoomScope(oldScope),
  });
}

function buildReservationConflictDetails({ roomId, checkinDate, checkoutDate, reservations }) {
  return {
    code: "RESERVATION_DATE_CONFLICT",
    roomId: String(roomId),
    requestedPeriod: {
      checkinDate: checkinDate.toISOString(),
      checkoutDate: checkoutDate.toISOString(),
    },
    conflictingReservations: reservations.map((reservation) => ({
      id: reservation.id,
      roomId: reservation.roomId,
      guestId: reservation.guestId,
      checkinDate: reservation.checkinDate,
      checkoutDate: reservation.checkoutDate,
      status: reservation.status,
      notes: reservation.notes,
      guest: reservation.guest
        ? {
            id: reservation.guest.id,
            name: reservation.guest.name,
            phone: reservation.guest.phone,
          }
        : null,
      room: reservation.room
        ? {
            id: reservation.room.id,
            title: reservation.room.title,
            stay: reservation.room.stay
              ? {
                  id: reservation.room.stay.id,
                  name: reservation.room.stay.name,
                }
              : null,
          }
        : null,
    })),
  };
}

async function findOverlappingReservations(tx, { roomId, checkinDate, checkoutDate, excludeId }) {
  const where = {
    roomId: String(roomId),
    status: { not: STATUS_CANCELADA },
    AND: [{ checkinDate: { lt: checkoutDate } }, { checkoutDate: { gt: checkinDate } }],
  };

  if (excludeId) {
    where.id = { not: String(excludeId) };
  }

  return tx.reservation.findMany({
    where,
    include: {
      guest: true,
      room: { include: { stay: true } },
    },
    orderBy: [{ checkinDate: "asc" }, { checkoutDate: "asc" }],
  });
}

function isPrismaError(error, code) {
  return Boolean(error && typeof error === "object" && error.code === code);
}

function handleReservationError(res, error, fallbackMessage) {
  if (error?.status) {
    return res.status(error.status).json({
      error: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }

  if (isPrismaError(error, "P2003")) {
    return res.status(400).json({
      error: "guestId ou roomId invalido. Verifique se hospede e quarto existem.",
    });
  }

  if (isPrismaError(error, "P2025")) {
    return res.status(404).json({ error: "Reserva nao encontrada." });
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({ error: fallbackMessage });
}

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
      return res.status(404).json({ error: "Reserva nao encontrada." });
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
  const normalizedStatus = normalizeStatus(status, DEFAULT_STATUS);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const checkin = toValidDate(checkinDate);
      const checkout = toValidDate(checkoutDate);

      if (!checkin || !checkout) {
        throw makeHttpError(400, "Datas de check-in/check-out invalidas.");
      }

      if (checkout <= checkin) {
        throw makeHttpError(400, "Data de check-out deve ser posterior ao check-in.");
      }

      const overlappingReservations = await findOverlappingReservations(tx, {
        roomId,
        checkinDate: checkin,
        checkoutDate: checkout,
      });

      if (overlappingReservations.length > 0) {
        throw makeHttpError(
          409,
          "Ja existe uma reserva ativa, agendada ou registrada neste periodo para esta acomodacao.",
          buildReservationConflictDetails({
            roomId,
            checkinDate: checkin,
            checkoutDate: checkout,
            reservations: overlappingReservations,
          })
        );
      }

      const reservation = await tx.reservation.create({
        data: {
          roomId: String(roomId),
          guestId: String(guestId),
          checkinDate: checkin,
          checkoutDate: checkout,
          status: normalizedStatus,
          notes: notes || null,
        },
        include: {
          room: { include: { stay: true } },
          guest: true,
        },
      });

      if (reservation.status !== STATUS_CANCELADA) {
        const scope = getTaskScopeFromReservation(reservation);
        await ensureSingleCheckoutTask(tx, scope);
      }

      return reservation;
    });

    return res.status(201).json(created);
  } catch (error) {
    return handleReservationError(res, error, "Erro ao criar reserva.");
  }
}

// PUT /reservations/:id
async function updateReservation(req, res) {
  const { id } = req.params;
  const { roomId, guestId, checkinDate, checkoutDate, status, notes } = req.body;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.reservation.findUnique({
        where: { id: String(id) },
        include: {
          room: { include: { stay: true } },
          guest: true,
        },
      });

      if (!current) {
        throw makeHttpError(404, "Reserva nao encontrada.");
      }

      const nextRoomId = roomId !== undefined ? String(roomId) : current.roomId;
      const nextGuestId = guestId !== undefined ? String(guestId) : current.guestId;
      const nextCheckin = checkinDate ? toValidDate(checkinDate) : current.checkinDate;
      const nextCheckout = checkoutDate ? toValidDate(checkoutDate) : current.checkoutDate;
      const nextStatus =
        status !== undefined ? normalizeStatus(status, current.status) : current.status;
      const nextNotes = notes !== undefined ? notes : current.notes;

      if (!nextCheckin || !nextCheckout) {
        throw makeHttpError(400, "Datas de check-in/check-out invalidas.");
      }

      if (nextCheckout <= nextCheckin) {
        throw makeHttpError(400, "Data de check-out deve ser posterior ao check-in.");
      }

      if (nextStatus !== STATUS_CANCELADA) {
        const overlappingReservations = await findOverlappingReservations(tx, {
          roomId: nextRoomId,
          checkinDate: nextCheckin,
          checkoutDate: nextCheckout,
          excludeId: id,
        });

        if (overlappingReservations.length > 0) {
          throw makeHttpError(
            409,
            "Ja existe uma reserva ativa, agendada ou registrada neste periodo para esta acomodacao.",
            buildReservationConflictDetails({
              roomId: nextRoomId,
              checkinDate: nextCheckin,
              checkoutDate: nextCheckout,
              reservations: overlappingReservations,
            })
          );
        }
      }

      const oldScope = getTaskScopeFromReservation(current);
      const scheduleAffected =
        nextStatus === STATUS_CANCELADA ||
        nextRoomId !== current.roomId ||
        !isSameUtcDay(nextCheckin, current.checkinDate) ||
        !isSameUtcDay(nextCheckout, current.checkoutDate);

      if (scheduleAffected) {
        const assignmentConflict = await getAssignedMaidConflictDetails(tx, oldScope, current);
        if (assignmentConflict) {
          throw makeHttpError(
            409,
            "Nao e permitido alterar ou cancelar a reserva: existe diarista designada para esse check-out.",
            assignmentConflict
          );
        }
      }

      const reservation = await tx.reservation.update({
        where: { id: String(id) },
        data: {
          roomId: nextRoomId,
          guestId: nextGuestId,
          checkinDate: nextCheckin,
          checkoutDate: nextCheckout,
          status: nextStatus,
          notes: nextNotes,
        },
        include: {
          room: { include: { stay: true } },
          guest: true,
        },
      });

      if (nextStatus === STATUS_CANCELADA) {
        await syncOldScopeAfterReservationChange(tx, {
          reservationIdToIgnore: current.id,
          roomId: current.roomId,
          effectiveCleaningDate: current.cleaningDateOverride || current.checkoutDate,
          oldScope,
        });
        return reservation;
      }

      const newScope = getTaskScopeFromReservation(reservation);
      const scopeChanged = getTaskScopeKey(oldScope) !== getTaskScopeKey(newScope);

      if (scopeChanged) {
        await syncOldScopeAfterReservationChange(tx, {
          reservationIdToIgnore: current.id,
          roomId: current.roomId,
          effectiveCleaningDate: current.cleaningDateOverride || current.checkoutDate,
          oldScope,
        });
      }

      await ensureSingleCheckoutTask(tx, newScope);
      return reservation;
    });

    return res.json(updated);
  } catch (error) {
    return handleReservationError(res, error, "Erro interno ao atualizar reserva.");
  }
}

// DELETE /reservations/:id
async function deleteReservation(req, res) {
  const { id } = req.params;

  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.reservation.findUnique({
        where: { id: String(id) },
        include: { room: { include: { stay: true } } },
      });

      if (!current) {
        throw makeHttpError(404, "Reserva nao encontrada.");
      }

      const oldScope = getTaskScopeFromReservation(current);
      const hasAssignedMaid = await hasAssignedMaidInScope(tx, oldScope);

      if (hasAssignedMaid) {
        throw makeHttpError(
          409,
          "Nao e permitido excluir/cancelar a reserva: existe diarista designada para esse check-out."
        );
      }

      await tx.reservation.delete({
        where: { id: String(id) },
      });

      await syncOldScopeAfterReservationChange(tx, {
        reservationIdToIgnore: current.id,
        roomId: current.roomId,
        effectiveCleaningDate: current.cleaningDateOverride || current.checkoutDate,
        oldScope,
      });
    });

    return res.json({
      message: "Reserva removida com sucesso.",
    });
  } catch (error) {
    return handleReservationError(res, error, "Erro interno ao deletar reserva.");
  }
}

// PUT /reservations/:id/cleaning-date
async function updateReservationCleaningDate(req, res) {
  const { id } = req.params;
  const { cleaningDate, reason } = req.body;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.reservation.findUnique({
        where: { id: String(id) },
        include: {
          room: { include: { stay: true } },
          guest: true,
        },
      });

      if (!current) {
        throw makeHttpError(404, "Reserva nao encontrada.");
      }

      if (current.status === STATUS_CANCELADA) {
        throw makeHttpError(400, "Nao e possivel alterar limpeza de reserva cancelada.");
      }

      const nextCleaningDate = cleaningDate ? toValidDate(cleaningDate) : null;
      const nextReason = typeof reason === "string" ? reason.trim() : "";

      if (cleaningDate && !nextCleaningDate) {
        throw makeHttpError(400, "Data de limpeza invalida.");
      }

      if (nextCleaningDate && !nextReason) {
        throw makeHttpError(400, "Informe o motivo da alteracao da limpeza.");
      }

      const oldScope = getTaskScopeFromReservation(current);
      const taskToMove = await tx.task.findFirst({
        where: getTaskWhereByRoomScope(oldScope),
        orderBy: { id: "asc" },
      });

      const reservation = await tx.reservation.update({
        where: { id: String(id) },
        data: {
          cleaningDateOverride: nextCleaningDate,
          cleaningChangeReason: nextCleaningDate ? nextReason : null,
        },
        include: {
          room: { include: { stay: true } },
          guest: true,
        },
      });

      const newScope = getTaskScopeFromReservation(reservation);
      const scopeChanged = getTaskScopeKey(oldScope) !== getTaskScopeKey(newScope);

      if (scopeChanged) {
        await syncOldScopeAfterReservationChange(tx, {
          reservationIdToIgnore: current.id,
          roomId: current.roomId,
          effectiveCleaningDate: current.cleaningDateOverride || current.checkoutDate,
          oldScope,
        });
      }

      const checkoutTask = await ensureSingleCheckoutTask(tx, newScope);
      if (scopeChanged && taskToMove?.maidId && !checkoutTask.maidId) {
        await tx.task.update({
          where: { id: checkoutTask.id },
          data: { maidId: taskToMove.maidId },
        });
      }
      return reservation;
    });

    return res.json(updated);
  } catch (error) {
    return handleReservationError(res, error, "Erro interno ao alterar data de limpeza.");
  }
}

module.exports = {
  getAllReservations,
  getReservationById,
  createReservation,
  updateReservation,
  updateReservationCleaningDate,
  deleteReservation,
};
