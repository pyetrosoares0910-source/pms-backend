import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

const femaleNames = new Set([
  "Ana",
  "Ana Paula",
  "Ana Clara",
  "Ana Beatriz",
  "Ana Luiza",
  "Amanda",
  "Adriana",
  "Aline",
  "Alessandra",
  "Alice",
  "Alicia",
  "Alícia",
  "Andreia",
  "Andréia",
  "Angela",
  "Ângela",
  "Barbara",
  "Bárbara",
  "Beatriz",
  "Bianca",
  "Bruna",
  "Camila",
  "Camilla",
  "Carla",
  "Carolina",
  "Caroline",
  "Catarina",
  "Cecilia",
  "Cecília",
  "Clara",
  "Claudia",
  "Cláudia",
  "Cristina",
  "Cristiane",
  "Christiane",
  "Cristiane",
  "Cristine",
  "Cristina",
  "Daniela",
  "Daniele",
  "Danielle",
  "Debora",
  "Débora",
  "Denise",
  "Diana",
  "Eduarda",
  "Elaine",
  "Eliane",
  "Elisa",
  "Elis",
  "Elisangela",
  "Elisângela",
  "Eliza",
  "Eloisa",
  "Eloísa",
  "Emily",
  "Emilly",
  "Erika",
  "Érika",
  "Estela",
  "Esther",
  "Fabiana",
  "Fernanda",
  "Flavia",
  "Flávia",
  "Franciele",
  "Francieli",
  "Gabriela",
  "Gabriella",
  "Gabrielle",
  "Gisele",
  "Giovana",
  "Giovanna",
  "Glaucia",
  "Gláucia",
  "Graziella",
  "Graziela",
  "Grazielle",
  "Heloisa",
  "Heloísa",
  "Helena",
  "Helena",
  "Ingrid",
  "Isabela",
  "Isabella",
  "Isadora",
  "Ivone",
  "Ivonei",
  "Jaqueline",
  "Jaquelina",
  "Jéssica",
  "Jessica",
  "Joana",
  "Joice",
  "Joyce",
  "Julia",
  "Júlia",
  "Juliana",
  "Juliane",
  "Julianne",
  "Karen",
  "Karina",
  "Karine",
  "Karla",
  "Larissa",
  "Laura",
  "Lais",
  "Laís",
  "Leticia",
  "Letícia",
  "Lidiane",
  "Liliane",
  "Liliana",
  "Livia",
  "Lívia",
  "Lorena",
  "Luana",
  "Luciana",
  "Luciane",
  "Lucia",
  "Lúcia",
  "Luiza",
  "Luísa",
  "Luna",
  "Marcela",
  "Marcele",
  "Marcia",
  "Márcia",
  "Mariana",
  "Mariane",
  "Marielle",
  "Marina",
  "Marlene",
  "Mayara",
  "Maíra",
  "Maira",
  "Melissa",
  "Michele",
  "Michelle",
  "Milena",
  "Monica",
  "Mônica",
  "Nadia",
  "Nádia",
  "Natalia",
  "Natália",
  "Nicole",
  "Nicolle",
  "Pamela",
  "Pâmela",
  "Patricia",
  "Patrícia",
  "Paula",
  "Priscila",
  "Priscilla",
  "Rafaela",
  "Raphaela",
  "Raquel",
  "Regina",
  "Renata",
  "Rita",
  "Roberta",
  "Rosana",
  "Rosangela",
  "Rosângela",
  "Rose",
  "Rosa",
  "Sabrina",
  "Samara",
  "Sandra",
  "Sara",
  "Sarah",
  "Sheila",
  "Simone",
  "Sofia",
  "Sophia",
  "Stephanie",
  "Stefany",
  "Suelen",
  "Sueli",
  "Talita",
  "Talitha",
  "Tatiane",
  "Tatiana",
  "Tatyane",
  "Tainara",
  "Tainá",
  "Tamara",
  "Tamires",
  "Tamiris",
  "Tatiane",
  "Tatiane",
  "Tatiane",
  "Teresa",
  "Tereza",
  "Valeria",
  "Valéria",
  "Vanessa",
  "Vanesa",
  "Veronica",
  "Verônica",
  "Vitoria",
  "Vitória",
  "Viviane",
  "Vivian",
  "Yasmin",
  "Yasmim",
]);

const maleNames = new Set([
  "Adriano",
  "Alan",
  "Alberto",
  "Alex",
  "Alexandre",
  "Alessandro",
  "Anderson",
  "Andre",
  "André",
  "Andrei",
  "Antonio",
  "Antônio",
  "Augusto",
  "Arthur",
  "Artur",
  "Bernardo",
  "Bruno",
  "Caio",
  "Carlos",
  "Cesar",
  "César",
  "Claudio",
  "Cláudio",
  "Cristiano",
  "Christian",
  "Cristian",
  "Daniel",
  "Danilo",
  "Davi",
  "David",
  "Diego",
  "Douglas",
  "Eduardo",
  "Edson",
  "Edgar",
  "Edmilson",
  "Elias",
  "Eliel",
  "Emerson",
  "Enzo",
  "Erick",
  "Eric",
  "Erik",
  "Estevao",
  "Estevão",
  "Everaldo",
  "Fabiano",
  "Fabio",
  "Fábio",
  "Felipe",
  "Felippe",
  "Fernando",
  "Francisco",
  "Gabriel",
  "Gabryel",
  "Guilherme",
  "Gustavo",
  "Heitor",
  "Hugo",
  "Igor",
  "Ismael",
  "Ivan",
  "Ivo",
  "Jair",
  "Jean",
  "Jefferson",
  "Jeferson",
  "Joao",
  "João",
  "Joaquim",
  "Jonas",
  "Jonathan",
  "Jonatan",
  "Jorge",
  "Jose",
  "José",
  "Josias",
  "Josue",
  "Josué",
  "Juan",
  "Julio",
  "Júlio",
  "Juliano",
  "Junior",
  "Júnior",
  "Kauan",
  "Kauã",
  "Kevin",
  "Kleber",
  "Leandro",
  "Leonardo",
  "Leonardo",
  "Leonel",
  "Lucas",
  "Luiz",
  "Luis",
  "Luís",
  "Luciano",
  "Luan",
  "Marcelo",
  "Marcio",
  "Márcio",
  "Marcos",
  "Marco",
  "Mario",
  "Mário",
  "Matheus",
  "Mateus",
  "Matteus",
  "Mauricio",
  "Maurício",
  "Michael",
  "Michel",
  "Miguel",
  "Murilo",
  "Nathan",
  "Nathaniel",
  "Nicolas",
  "Nícolas",
  "Nicolau",
  "Otavio",
  "Otávio",
  "Paulo",
  "Pedro",
  "Rafael",
  "Raphael",
  "Rayan",
  "Renan",
  "Renato",
  "Ricardo",
  "Roberto",
  "Rodrigo",
  "Roger",
  "Rogério",
  "Rogerio",
  "Ronaldo",
  "Samuel",
  "Sandro",
  "Sergio",
  "Sérgio",
  "Sidney",
  "Silvio",
  "Sílvio",
  "Tadeu",
  "Thiago",
  "Tiago",
  "Thomas",
  "Tomás",
  "Tomas",
  "Valter",
  "Walter",
  "Victor",
  "Vitor",
  "Vinicius",
  "Vinícius",
  "Wagner",
  "Wallace",
  "Wellington",
  "William",
  "Willian",
  "Yago",
  "Yuri",
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

export function getWeekStartMonday(value) {
  const base = dayjs(value).startOf("day");
  const weekday = base.day();
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  return base.add(diffToMonday, "day");
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

export function getPresentationStayKey(reservation) {
  return reservation.room?.stay?.id || reservation.room?.stay?.name || "sem-stay";
}

export function getPresentationGuestGroupKey(reservation) {
  return String(reservation.guest?.name || "").trim() || `sem-nome:${reservation.id}`;
}

export function isPendingPresentationReservation(reservation) {
  return String(reservation.status || "").toLowerCase() === "registrada";
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

function sortPresentationGroupReservations(items) {
  return [...items].sort((a, b) => {
    const roomCompare = compareRoomsInMapOrder(a.room || {}, b.room || {});
    if (roomCompare !== 0) return roomCompare;

    const checkinCompare = dayjs.utc(a.checkinDate).valueOf() - dayjs.utc(b.checkinDate).valueOf();
    if (checkinCompare !== 0) return checkinCompare;

    const checkoutCompare = dayjs.utc(a.checkoutDate).valueOf() - dayjs.utc(b.checkoutDate).valueOf();
    if (checkoutCompare !== 0) return checkoutCompare;

    return String(a.guest?.name || "").localeCompare(String(b.guest?.name || ""), "pt-BR");
  });
}

function formatJoinedList(values) {
  if (values.length <= 1) return values[0] || "";
  if (values.length === 2) return `${values[0]} e ${values[1]}`;
  return `${values.slice(0, -1).join(", ")} e ${values[values.length - 1]}`;
}

function formatRoomNamesForMessage(reservations) {
  const names = [];
  const seen = new Set();

  sortPresentationGroupReservations(reservations).forEach((reservation) => {
    const roomKey = reservation.room?.id || reservation.room?.title || reservation.id;
    if (seen.has(roomKey)) return;

    seen.add(roomKey);
    names.push(`*${reservation.room?.title || "sua acomodacao"}*`);
  });

  return formatJoinedList(names);
}

function hasSameReservationPeriod(reservations) {
  if (reservations.length <= 1) return true;

  const firstCheckin = dayjs.utc(reservations[0]?.checkinDate);
  const firstCheckout = dayjs.utc(reservations[0]?.checkoutDate);

  return reservations.every(
    (reservation) =>
      dayjs.utc(reservation.checkinDate).isSame(firstCheckin, "day") &&
      dayjs.utc(reservation.checkoutDate).isSame(firstCheckout, "day")
  );
}

function buildReservationPeriodLines(reservations) {
  return sortPresentationGroupReservations(reservations).map((reservation) => {
    const roomName = reservation.room?.title || "sua acomodacao";
    return `*${roomName}*: de *${formatDate(reservation.checkinDate)}* ate *${formatDate(
      reservation.checkoutDate
    )}*.`;
  });
}

export function getWeeklyPresentationSummary(reservations, baseDate = new Date()) {
  const normalizedStartDate = getWeekStartMonday(baseDate);
  const start = dayjs.utc(normalizedStartDate).startOf("day");
  const end = dayjs.utc(normalizedStartDate).add(8, "day").endOf("day");
  const groups = new Map();

  (reservations || []).forEach((reservation) => {
    if (reservation.status === "cancelada" || !reservation.checkinDate) return;

    const checkin = dayjs.utc(reservation.checkinDate);
    if (!checkin.isBetween(start, end, null, "[]")) return;

    const stayKey = getPresentationStayKey(reservation);
    const guestKey = getPresentationGuestGroupKey(reservation);
    const groupKey = `${stayKey}::${guestKey}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }

    groups.get(groupKey).push(reservation);
  });

  const total = groups.size;
  const pending = [...groups.values()].filter((items) =>
    items.some((reservation) => isPendingPresentationReservation(reservation))
  ).length;
  const completed = total - pending;
  const reservationCount = [...groups.values()].reduce((sum, items) => sum + items.length, 0);

  return {
    total,
    pending,
    completed,
    reservations: reservationCount,
    startDate: normalizedStartDate.format("YYYY-MM-DD"),
    endDate: normalizedStartDate.add(8, "day").format("YYYY-MM-DD"),
  };
}

export function getPresentationMessages(input, settings) {
  const reservations = sortPresentationGroupReservations(
    Array.isArray(input) ? input.filter(Boolean) : [input].filter(Boolean)
  );
  const reservation = reservations[0];

  if (!reservation) return [];

  const stayName = reservation.room?.stay?.name || "seu empreendimento";
  const roomName = reservation.room?.title || "sua acomodacao";
  const guestName = reservation.guest?.name || "hospede";
  const gender = settings.genderOverrides[getGenderKey(reservation)] || inferGender(guestName);
  const { welcome, pronoun } = getGreetingTarget(gender);
  const greeting = getGreeting();
  const hostName = settings.hostName || "Pyetro";
  const classification = getClassification(reservation);

  if (classification === "clariza" && reservations.length === 1) {
    return [
      [
        `Ola, ${greeting}!`,
        "",
        `*Seja ${welcome} ao Condominio Edifício Clariza* 🌎`,
        "",
        `Confirmada reserva no apartamento *${roomName}*, com início em ${formatDate(
          reservation.checkinDate
        )} e término em ${formatDate(reservation.checkoutDate)}.`,
        "",
        `Me chamo ${hostName}, estarei responsavel pelo acompanhamento da estadia e disponivel para qualquer suporte que se fizer necessario.`,
      ].join("\n"),
    ];
  }

  if (reservations.length > 1) {
    if (hasSameReservationPeriod(reservations)) {
      return [
        [
          `Ola, ${greeting}!`,
          "",
          `*Seja ${welcome} ao ${stayName}* ðŸŒŽ`,
          `Suas reservas nos studios ${formatRoomNamesForMessage(
            reservations
          )} estão confirmadas, com check-in no dia ${formatDate(
            reservation.checkinDate
          )} e check-out no dia ${formatDate(reservation.checkoutDate)}.`,
          "",
          `Meu nome e ${hostName}, e estarei a disposição para ajuda-${pronoun} durante sua estadia.`,
          "No dia do check-in, enviarei as informações de acesso e as instruções necessárias para entrar nas acomodações.",
          "",
          "Se tiver qualquer duvida ou precisar de algo, nao hesite em me procurar.",
          "Ate breve!",
        ].join("\n"),
      ];
    }

    return [
      [
        `Ola, ${greeting}!`,
        "",
        `*Seja ${welcome} ao ${stayName}* ðŸŒŽ`,
        "Confirmamos o recebimento das seguintes reservas:",
        ...buildReservationPeriodLines(reservations),
        "",
        `Meu nome e ${hostName}, e estarei a disposição para ajuda-${pronoun} durante sua estadia.`,
        "No dia do check-in, enviarei as informações de acesso e as instruções necessárias para entrar nas acomodações.",
        "",
        "Se tiver qualquer duvida ou precisar de algo, nao hesite em me procurar.",
        "Ate breve!",
      ].join("\n"),
    ];
  }

  return [
    [
      `Olá, ${greeting}!`,
      "",
      `*Seja ${welcome} ao ${stayName}* 🌎`,
      `Sua reserva no studio *${roomName}* está confirmada, com check-in no dia ${formatDate(
        reservation.checkinDate
      )} e check-out no dia ${formatDate(reservation.checkoutDate)}.`,
      "",
      `Meu nome e ${hostName}, e estarei a disposição para ajuda-${pronoun} durante sua estadia.`,
      "No dia do check-in, enviarei as informações de acesso e as instruções necessárias para entrar no studio assim que disponível.",
      "",
      "Se tiver qualquer duvida ou precisar de algo, nao hesite em me procurar.",
      "Ate breve!",
    ].join("\n"),
  ];
}
