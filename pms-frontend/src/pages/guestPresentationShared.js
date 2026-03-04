import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

const femaleNames = new Set([
  "ana",
  "amanda",
  "beatriz",
  "bianca",
  "bruna",
  "camila",
  "carla",
  "carolina",
  "clara",
  "daniela",
  "fernanda",
  "gabriela",
  "giovanna",
  "isabela",
  "isabella",
  "julia",
  "juliana",
  "larissa",
  "leticia",
  "luana",
  "luciana",
  "marcela",
  "maria",
  "mariana",
  "patricia",
  "paula",
  "priscila",
  "renata",
  "sabrina",
  "tatiana",
  "vanessa",
  "vitoria",
  "yasmin",
]);

const maleNames = new Set([
  "andre",
  "antonio",
  "augusto",
  "bruno",
  "caio",
  "carlos",
  "daniel",
  "diego",
  "eduardo",
  "felipe",
  "fernando",
  "gabriel",
  "gustavo",
  "henrique",
  "igor",
  "joao",
  "jorge",
  "jose",
  "leonardo",
  "lucas",
  "luiz",
  "marcos",
  "mateus",
  "murilo",
  "pedro",
  "rafael",
  "ricardo",
  "rodrigo",
  "thiago",
  "vinicius",
  "vitor",
]);

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function extractRoomNumber(value) {
  const match = String(value || "").match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function getGreeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "bom dia";
  if (hour < 18) return "boa tarde";
  return "boa noite";
}

function getClassification(reservation) {
  const stayName = normalizeText(reservation.room?.stay?.name);
  if (stayName.includes("clariza")) return "clariza";
  return "default";
}

function getGreetingTarget(gender) {
  return {
    welcome: gender === "feminine" ? "bem-vinda" : "bem-vindo",
    pronoun: gender === "feminine" ? "la" : "lo",
  };
}

export function formatDate(value) {
  return dayjs.utc(value).format("DD/MM");
}

export function formatFullDate(value) {
  return dayjs(value).format("DD/MM/YYYY");
}

export function getGenderKey(reservation) {
  return reservation.guest?.id || reservation.guestId || reservation.id;
}

export function inferGender(name) {
  const firstName = normalizeText(name).split(/\s+/)[0];
  if (!firstName) return "feminine";
  if (femaleNames.has(firstName)) return "feminine";
  if (maleNames.has(firstName)) return "masculine";
  if (firstName.endsWith("a")) return "feminine";
  return "masculine";
}

export function compareRoomsInMapOrder(a, b) {
  const stayPosDiff = (a?.stay?.position ?? 9999) - (b?.stay?.position ?? 9999);
  if (stayPosDiff !== 0) return stayPosDiff;

  const stayNameDiff = String(a?.stay?.name || "").localeCompare(String(b?.stay?.name || ""), "pt-BR");
  if (stayNameDiff !== 0) return stayNameDiff;

  const roomPosDiff = (a?.position ?? 9999) - (b?.position ?? 9999);
  if (roomPosDiff !== 0) return roomPosDiff;

  const roomNumberDiff = (extractRoomNumber(a?.title) ?? 9999) - (extractRoomNumber(b?.title) ?? 9999);
  if (roomNumberDiff !== 0) return roomNumberDiff;

  return String(a?.title || "").localeCompare(String(b?.title || ""), "pt-BR");
}

export function sortReservations(items, roomMetaById = {}) {
  return [...items].sort((a, b) => {
    const roomA = roomMetaById[a.roomId] || a.room || {};
    const roomB = roomMetaById[b.roomId] || b.room || {};

    const roomCompare = compareRoomsInMapOrder(roomA, roomB);
    if (roomCompare !== 0) return roomCompare;

    const checkinCompare = dayjs.utc(a.checkinDate).valueOf() - dayjs.utc(b.checkinDate).valueOf();
    if (checkinCompare !== 0) return checkinCompare;

    const checkoutCompare =
      dayjs.utc(a.checkoutDate).valueOf() - dayjs.utc(b.checkoutDate).valueOf();
    if (checkoutCompare !== 0) return checkoutCompare;

    return String(a.guest?.name || "").localeCompare(String(b.guest?.name || ""), "pt-BR");
  });
}

export function getPresentationMessages(reservation, settings) {
  const stayName = reservation.room?.stay?.name || "seu empreendimento";
  const roomName = reservation.room?.title || "sua acomodacao";
  const guestName = reservation.guest?.name || "hospede";
  const gender = settings.genderOverrides[getGenderKey(reservation)] || inferGender(guestName);
  const { welcome, pronoun } = getGreetingTarget(gender);
  const greeting = getGreeting();
  const hostName = settings.hostName || "Pyetro";
  const classification = getClassification(reservation);

  if (classification === "clariza") {
    return [
      [
        `Ola, ${greeting}!`,
        "",
        `Seja ${welcome} ao Condominio Edificio Clariza`,
        "",
        `Confirmada reserva no apartamento ${roomName}, com inicio em ${formatDate(
          reservation.checkinDate
        )} e termino em ${formatDate(reservation.checkoutDate)}.`,
        "",
        `Me chamo ${hostName}, estarei responsavel pelo acompanhamento da estadia e disponivel para qualquer suporte que se fizer necessario.`,
      ].join("\n"),
    ];
  }

  return [
    [
      `Ola, ${greeting}!`,
      "",
      `Seja ${welcome} ao ${stayName}`,
      `Sua reserva no studio ${roomName} esta confirmada, com check-in no dia ${formatDate(
        reservation.checkinDate
      )} e check-out no dia ${formatDate(reservation.checkoutDate)}.`,
      "",
      `Meu nome e ${hostName}, e estarei a disposicao para ajuda-${pronoun} durante sua estadia.`,
      "No dia do check-in, enviarei as informacoes de acesso e as instrucoes necessarias para entrar no studio.",
      "",
      "Se tiver qualquer duvida ou precisar de algo, nao hesite em me procurar.",
      "Ate breve!",
    ].join("\n"),
  ];
}
