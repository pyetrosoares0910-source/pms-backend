import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { getGenderKey, inferGender } from "./guestPresentationShared";

dayjs.extend(utc);

export const GUEST_CHECKOUT_SETTINGS_KEY = "guest-checkouts-settings-v1";
export const GUEST_CHECKOUT_SETTINGS_EVENT = "guest-checkouts-settings-changed";

export const defaultGuestCheckoutSettings = {
  defaults: {
    checkoutTime: "10h",
    formLink: "",
  },
  stays: {},
  genderOverrides: {},
  deliveryStatus: {},
};

function sameDay(dateA, dateB) {
  return dayjs.utc(dateA).isSame(dayjs.utc(dateB), "day");
}

function getGreeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "bom dia";
  if (hour < 18) return "boa tarde";
  return "boa noite";
}

function getGreetingTarget(gender) {
  return {
    pronoun: gender === "feminine" ? "la" : "lo",
  };
}

export function getGuestCheckoutStayKey(input) {
  const stay = input?.room?.stay || input;
  return stay?.id || stay?.name || "sem-stay";
}

export function makeGuestCheckoutDeliveryKey(reservation) {
  return [
    dayjs.utc(reservation?.checkoutDate).format("YYYY-MM-DD"),
    reservation?.id || "sem-reserva",
    reservation?.room?.id || reservation?.roomId || reservation?.room?.title || "sem-room",
  ].join("|");
}

export function getStoredGuestCheckoutSettings() {
  if (typeof localStorage === "undefined") {
    return defaultGuestCheckoutSettings;
  }

  try {
    const raw = localStorage.getItem(GUEST_CHECKOUT_SETTINGS_KEY);
    if (!raw) return defaultGuestCheckoutSettings;

    const parsed = JSON.parse(raw);
    return {
      defaults: {
        ...defaultGuestCheckoutSettings.defaults,
        ...(parsed.defaults || {}),
      },
      stays: parsed.stays || {},
      genderOverrides: parsed.genderOverrides || {},
      deliveryStatus: parsed.deliveryStatus || {},
    };
  } catch {
    return defaultGuestCheckoutSettings;
  }
}

export function saveGuestCheckoutSettings(next) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(GUEST_CHECKOUT_SETTINGS_KEY, JSON.stringify(next));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(GUEST_CHECKOUT_SETTINGS_EVENT));
  }
}

export function getGuestCheckoutStaySettings(settings, stayInput) {
  const stayKey = getGuestCheckoutStayKey(stayInput);
  const staySettings = settings?.stays?.[stayKey] || {};

  return {
    checkoutTime: staySettings.checkoutTime || settings?.defaults?.checkoutTime || "",
    formLink: staySettings.formLink || settings?.defaults?.formLink || "",
  };
}

export function isPendingGuestCheckoutReservation(
  reservation,
  settings = getStoredGuestCheckoutSettings()
) {
  if (!reservation || String(reservation.status || "").toLowerCase() === "cancelada") {
    return false;
  }

  return !settings.deliveryStatus[makeGuestCheckoutDeliveryKey(reservation)];
}

export function getDailyGuestCheckoutSummary(
  reservations,
  baseDate = new Date(),
  settings = getStoredGuestCheckoutSettings()
) {
  const normalizedDate = dayjs(baseDate).format("YYYY-MM-DD");
  const dailyReservations = (reservations || []).filter((reservation) => {
    const status = String(reservation.status || "").toLowerCase();
    return (
      status !== "cancelada" &&
      reservation.checkoutDate &&
      sameDay(reservation.checkoutDate, normalizedDate)
    );
  });

  const sent = dailyReservations.filter(
    (reservation) => !isPendingGuestCheckoutReservation(reservation, settings)
  ).length;

  return {
    date: normalizedDate,
    total: dailyReservations.length,
    sent,
    pending: dailyReservations.length - sent,
  };
}

export function buildGuestCheckoutAlert(summary, targetLabel = "hoje") {
  if (summary.pending > 0) {
    return {
      isPending: true,
      message: `Alerta: ${summary.pending} de ${summary.total} mensagem(ns) de check-out de ${targetLabel} ainda pendente(s).`,
    };
  }

  if (summary.total > 0) {
    return {
      isPending: false,
      message: `Tudo certo: ${summary.sent} de ${summary.total} mensagem(ns) de check-out de ${targetLabel} já foram confirmadas.`,
    };
  }

  return {
    isPending: false,
    message: `Tudo certo: não há check-outs previstos para ${targetLabel}.`,
  };
}

export function getGuestCheckoutMessage(
  reservation,
  settings = getStoredGuestCheckoutSettings()
) {
  if (!reservation) return "";

  const guestName = reservation.guest?.name || "hóspede";
  const gender =
    settings.genderOverrides[getGenderKey(reservation)] || inferGender(guestName);
  const { pronoun } = getGreetingTarget(gender);
  const greeting = getGreeting();
  const stayName = reservation.room?.stay?.name || "seu empreendimento";
  const roomName = reservation.room?.title || "sua acomodação";
  const staySettings = getGuestCheckoutStaySettings(settings, reservation);

  return [
    `Olá, ${greeting}!`,
    "",
    `Esperamos que sua estadia no *${stayName} - ${roomName}* tenha sido excelente! ✨`,
    "",
    `Este é um lembrete de que o seu check-out está previsto para hoje, até ${staySettings.checkoutTime}.`,
    `Caso precise de algum suporte ou tenha qualquer dúvida, estou à disposição para ajudá-${pronoun}.`,
    "",
    "Antes de partir, se quiser ficar por dentro de disponibilidades especiais e promoções futuras nas nossas propriedades em São Paulo, preencha nosso formulário rápido:",
    staySettings.formLink,
    "",
    "Foi um prazer receber você por aqui!",
    `Esperamos ter a oportunidade de recebê-${pronoun} novamente em breve. 🙌🏻`,
    "",
    "Tenha um ótimo dia!",
  ].join("\n");
}
