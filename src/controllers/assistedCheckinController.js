const { PrismaClient } = require("@prisma/client");
const {
  isAssistedCheckinReadyForActivation,
  normalizeAssistedCheckinPayload,
  withAssistedCheckinStatus,
  withReservationAssistedStatus,
} = require("../services/assistedCheckins");

const prisma = new PrismaClient();

function toValidDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function generateMaintenanceCode(tx) {
  const year = new Date().getFullYear();
  const stamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000);
  return `MT-${year}-${stamp}-${random}`;
}

async function getResponsibleName(tx, collaboratorId) {
  if (!collaboratorId) return null;
  const collaborator = await tx.maintenanceCollaborator.findUnique({
    where: { id: String(collaboratorId) },
    select: { name: true },
  });
  return collaborator?.name || null;
}

function formatPtBrDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(value);
}

function buildKeyDeliveryTaskData(reservation, assistedCheckin, responsibleName, collaboratorId) {
  const scheduled = assistedCheckin.scheduledArrivalAt;
  const stayName = reservation.room?.stay?.name || "Sem empreendimento";
  const roomTitle = reservation.room?.title || "Sem unidade";
  const guestName = reservation.guest?.name || "Hospede sem nome";
  const scheduledLabel = formatPtBrDateTime(scheduled);

  return {
    title: `Entrega de chaves - ${roomTitle}`,
    description: [
      `Check-in presencial para ${guestName}.`,
      scheduledLabel ? `Horario combinado: ${scheduledLabel}.` : null,
      `Unidade: ${roomTitle}.`,
      `Empreendimento: ${stayName}.`,
      "Confirmar entrega das chaves na pagina Check-ins presenciais.",
      assistedCheckin.notes ? `Observacoes: ${assistedCheckin.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    stayId: reservation.room?.stayId || null,
    roomId: reservation.roomId,
    responsible: responsibleName,
    collaboratorId: collaboratorId || null,
    status: "pendente",
    type: "check-in presencial",
    dueDate: scheduled,
    isRecurring: false,
    timezone: "America/Sao_Paulo",
  };
}

async function syncKeyDeliveryMaintenanceTask(tx, reservation, assistedCheckin, collaboratorId) {
  if (!assistedCheckin.scheduledArrivalAt) {
    if (assistedCheckin.maintenanceTaskId) {
      await tx.maintenanceTask.deleteMany({
        where: {
          id: assistedCheckin.maintenanceTaskId,
          status: { not: "concluido" },
        },
      });
      return tx.assistedCheckin.update({
        where: { id: assistedCheckin.id },
        data: { maintenanceTaskId: null },
      });
    }
    return assistedCheckin;
  }

  const currentTask = assistedCheckin.maintenanceTaskId
    ? await tx.maintenanceTask.findUnique({
        where: { id: assistedCheckin.maintenanceTaskId },
        select: { collaboratorId: true, status: true },
      })
    : null;
  const nextCollaboratorId =
    typeof collaboratorId === "undefined" ? currentTask?.collaboratorId || null : collaboratorId || null;
  const responsibleName = await getResponsibleName(tx, nextCollaboratorId);
  const data = buildKeyDeliveryTaskData(
    reservation,
    assistedCheckin,
    responsibleName,
    nextCollaboratorId
  );

  if (assistedCheckin.maintenanceTaskId && currentTask) {
    await tx.maintenanceTask.update({
      where: { id: assistedCheckin.maintenanceTaskId },
      data: {
        ...data,
        status: currentTask.status === "concluido" ? "concluido" : data.status,
      },
    });
    return tx.assistedCheckin.findUnique({
      where: { id: assistedCheckin.id },
      include: { maintenanceTask: { include: { collaborator: true } } },
    });
  }

  const task = await tx.maintenanceTask.create({
    data: {
      code: await generateMaintenanceCode(tx),
      ...data,
    },
  });

  return tx.assistedCheckin.update({
    where: { id: assistedCheckin.id },
    data: { maintenanceTaskId: task.id },
    include: { maintenanceTask: { include: { collaborator: true } } },
  });
}

function buildDateWhere(query) {
  const now = new Date();
  const from = toValidDate(query.from) || addDays(now, -7);
  const to = toValidDate(query.to) || addDays(now, 45);
  return {
    gte: new Date(`${from.toISOString().slice(0, 10)}T00:00:00.000Z`),
    lte: new Date(`${to.toISOString().slice(0, 10)}T23:59:59.999Z`),
  };
}

async function listAssistedCheckins(req, res) {
  try {
    const reservations = await prisma.reservation.findMany({
      where: {
        status: { not: "cancelada" },
        checkinDate: buildDateWhere(req.query),
        room: {
          selfCheckinEnabled: false,
        },
      },
      include: {
        room: { include: { stay: true } },
        guest: true,
        assistedCheckin: {
          include: { maintenanceTask: { include: { collaborator: true } } },
        },
      },
      orderBy: [{ checkinDate: "asc" }, { createdAt: "asc" }],
    });

    return res.json(reservations.map(withReservationAssistedStatus));
  } catch (error) {
    console.error("Erro ao listar check-ins presenciais:", error);
    return res.status(500).json({ error: "Erro ao listar check-ins presenciais." });
  }
}

async function getAssistedCheckin(req, res) {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: String(req.params.reservationId) },
      include: {
        room: { include: { stay: true } },
        guest: true,
        assistedCheckin: {
          include: { maintenanceTask: { include: { collaborator: true } } },
        },
      },
    });

    if (!reservation) {
      return res.status(404).json({ error: "Reserva nao encontrada." });
    }

    return res.json(withReservationAssistedStatus(reservation));
  } catch (error) {
    console.error("Erro ao buscar check-in presencial:", error);
    return res.status(500).json({ error: "Erro ao buscar check-in presencial." });
  }
}

async function upsertAssistedCheckin(req, res) {
  try {
    const reservationId = String(req.params.reservationId);
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { room: { include: { stay: true } }, guest: true },
    });

    if (!reservation) {
      return res.status(404).json({ error: "Reserva nao encontrada." });
    }

    if (reservation.room?.selfCheckinEnabled !== false) {
      return res.status(400).json({
        error: "Esta reserva pertence a uma unidade com self-check-in habilitado.",
      });
    }

    const data = normalizeAssistedCheckinPayload(req.body);
    const hasCollaboratorPayload = Object.prototype.hasOwnProperty.call(
      req.body,
      "maintenanceCollaboratorId"
    );
    const maintenanceCollaboratorId = hasCollaboratorPayload
      ? req.body.maintenanceCollaboratorId || null
      : undefined;
    const invalidFields = Object.entries(data)
      .filter(([field, value]) => field !== "notes" && typeof value === "undefined")
      .map(([field]) => field);

    if (invalidFields.length > 0) {
      return res.status(400).json({
        error: "Data invalida no check-in presencial.",
        details: { invalidFields },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      let assistedCheckin = await tx.assistedCheckin.upsert({
        where: { reservationId },
        create: {
          reservationId,
          ...data,
        },
        update: data,
      });

      if (
        Object.prototype.hasOwnProperty.call(data, "scheduledArrivalAt") ||
        Object.prototype.hasOwnProperty.call(data, "notes") ||
        hasCollaboratorPayload
      ) {
        assistedCheckin = await syncKeyDeliveryMaintenanceTask(
          tx,
          reservation,
          assistedCheckin,
          maintenanceCollaboratorId
        );
      }

      if (
        Object.prototype.hasOwnProperty.call(data, "keyDeliveryConfirmedAt") &&
        assistedCheckin.maintenanceTaskId
      ) {
        await tx.maintenanceTask.update({
          where: { id: assistedCheckin.maintenanceTaskId },
          data: { status: assistedCheckin.keyDeliveryConfirmedAt ? "concluido" : "pendente" },
        });
        assistedCheckin = await tx.assistedCheckin.findUnique({
          where: { id: assistedCheckin.id },
          include: { maintenanceTask: { include: { collaborator: true } } },
        });
      }

      let reservationStatus = reservation.status;
      if (
        isAssistedCheckinReadyForActivation(assistedCheckin) &&
        !["ativa", "concluida", "cancelada"].includes(reservation.status)
      ) {
        const updatedReservation = await tx.reservation.update({
          where: { id: reservationId },
          data: { status: "ativa" },
          select: { status: true },
        });
        reservationStatus = updatedReservation.status;
      }

      return {
        assistedCheckin,
        reservationStatus,
      };
    });

    return res.json({
      ...withAssistedCheckinStatus(result.assistedCheckin),
      reservationStatus: result.reservationStatus,
    });
  } catch (error) {
    console.error("Erro ao salvar check-in presencial:", error);
    return res.status(500).json({ error: "Erro ao salvar check-in presencial." });
  }
}

module.exports = {
  getAssistedCheckin,
  listAssistedCheckins,
  upsertAssistedCheckin,
};
