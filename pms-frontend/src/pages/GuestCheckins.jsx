import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useApi } from "../lib/api";

dayjs.extend(utc);

const SETTINGS_KEY = "guest-checkins-settings-v2";

const defaultSettings = {
  hostName: "Pyetro",
  genderOverrides: {},
  stayInfo: {},
  staySecrets: {},
  roomInfo: {},
  roomSecrets: {},
  reservationSecrets: {},
};

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

function pickFields(source, fields) {
  const next = {};
  fields.forEach((field) => {
    next[field] = source?.[field] || "";
  });
  return next;
}

function getStoredSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    const legacyStayAccess = parsed.stayAccess || {};
    const legacyRoomAccess = parsed.roomAccess || {};

    const stayInfoFromLegacy = Object.fromEntries(
      Object.entries(legacyStayAccess).map(([stayName, data]) => [
        stayName,
        pickFields(data, [
          "address",
          "pickupAddress",
          "apartmentAddress",
          "wifiName",
          "wifiPassword",
          "tokenLabel",
        ]),
      ])
    );

    const staySecretsFromLegacy = Object.fromEntries(
      Object.entries(legacyStayAccess).map(([stayName, data]) => [
        stayName,
        pickFields(data, ["door1", "door2", "keySafeCode"]),
      ])
    );

    const roomInfoFromLegacy = Object.fromEntries(
      Object.entries(legacyRoomAccess).map(([roomKey, data]) => [
        roomKey,
        pickFields(data, [
          "address",
          "pickupAddress",
          "apartmentAddress",
          "wifiName",
          "wifiPassword",
          "tokenLabel",
        ]),
      ])
    );

    const roomSecretsFromLegacy = Object.fromEntries(
      Object.entries(legacyRoomAccess).map(([roomKey, data]) => [
        roomKey,
        pickFields(data, ["door1", "door2", "unitDoor", "keySafeCode", "apartmentDoorCode"]),
      ])
    );

    return {
      hostName: parsed.hostName || defaultSettings.hostName,
      genderOverrides: parsed.genderOverrides || {},
      stayInfo: parsed.stayInfo || stayInfoFromLegacy,
      staySecrets: parsed.staySecrets || staySecretsFromLegacy,
      roomInfo: parsed.roomInfo || roomInfoFromLegacy,
      roomSecrets: parsed.roomSecrets || roomSecretsFromLegacy,
      reservationSecrets: parsed.reservationSecrets || {},
    };
  } catch {
    return defaultSettings;
  }
}

function saveSettings(next) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

function formatDate(value) {
  return dayjs.utc(value).format("DD/MM");
}

function formatFullDate(value) {
  return dayjs(value).format("DD/MM/YYYY");
}

function sameDay(dateA, dateB) {
  return dayjs.utc(dateA).isSame(dayjs.utc(dateB), "day");
}

function getGreeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "bom dia";
  if (hour < 18) return "boa tarde";
  return "boa noite";
}

function getGenderKey(reservation) {
  return reservation.guest?.id || reservation.guestId || reservation.id;
}

function inferGender(name) {
  const firstName = normalizeText(name).split(/\s+/)[0];
  if (!firstName) return "feminine";
  if (femaleNames.has(firstName)) return "feminine";
  if (maleNames.has(firstName)) return "masculine";
  if (firstName.endsWith("a")) return "feminine";
  return "masculine";
}

function getGreetingTarget(gender) {
  return {
    welcome: gender === "feminine" ? "bem-vinda" : "bem-vindo",
    pronoun: gender === "feminine" ? "la" : "lo",
  };
}

function getReservationRoomKey(reservation) {
  return getRoomKey(reservation);
}

function getRoomKey(input) {
  if (!input) return "sem-room";
  const room = input.room || input;
  return room.id || `${room.stay?.name || "sem-stay"}|${room.title || input.id || "sem-room"}`;
}

function getStayInfo(settings, reservation) {
  return settings.stayInfo[reservation.room?.stay?.name || ""] || {};
}

function getStaySecrets(settings, reservation) {
  return settings.staySecrets[reservation.room?.stay?.name || ""] || {};
}

function getRoomInfo(settings, input) {
  return settings.roomInfo[getRoomKey(input)] || {};
}

function getRoomSecrets(settings, input) {
  return settings.roomSecrets[getRoomKey(input)] || {};
}

function getReservationSecrets(settings, reservation) {
  return settings.reservationSecrets[reservation.id] || {};
}

function getRoomConfig(settings, reservation) {
  return {
    ...getRoomInfo(settings, reservation),
    ...getRoomSecrets(settings, reservation),
    ...getReservationSecrets(settings, reservation),
  };
}

function extractRoomNumber(value) {
  const match = String(value || "").match(/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

function compareRoomsInMapOrder(a, b) {
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

function sortReservations(items, roomMetaById = {}) {
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

function getIguatemiBStairsHint(roomName) {
  const roomNumber = extractRoomNumber(roomName);
  if (roomNumber === 7) return "Depois da segunda porta, suba 1 lance de escadas ate a acomodacao 7.";
  if (roomNumber === 8 || roomNumber === 9) {
    return "Depois da segunda porta, suba 2 lances de escadas ate a acomodacao.";
  }
  return "";
}

function getInternacionalFloorHint(roomName) {
  const roomNumber = extractRoomNumber(roomName);
  if (roomNumber >= 1 && roomNumber <= 4) return "As acomodacoes 1 a 4 ficam no terreo.";
  if (roomNumber >= 5 && roomNumber <= 10) {
    return "As acomodacoes 5 a 10 ficam no 1o andar, acessado por 1 lance de escadas.";
  }
  return "";
}

function getClassification(reservation) {
  const stayName = normalizeText(reservation.room?.stay?.name);
  const roomName = normalizeText(reservation.room?.title);

  if (stayName.includes("clariza")) return "clariza";
  if (stayName.includes("itaim")) return "itaim";
  if (stayName.includes("jk")) return "jk";
  if (stayName.includes("internacional")) return "internacional";
  if (stayName.includes("iguatemi") && stayName.includes("b") && stayName.includes("terreo")) {
    if (roomName.includes("15") || roomName.includes("malasia")) return "iguatemi-bt-15";
    if (roomName.includes("16") || roomName.includes("singapura")) return "iguatemi-bt-16";
    return "iguatemi-bt";
  }
  if (stayName.includes("iguatemi") && stayName.includes("a") && stayName.includes("terreo")) {
    return "iguatemi-at";
  }
  if (stayName.includes("iguatemi") && stayName.includes("b")) return "iguatemi-b";
  if (stayName.includes("iguatemi") && stayName.includes("a")) return "iguatemi-a";
  return "default";
}

function getPresentationMessages(reservation, settings) {
  const stayName = reservation.room?.stay?.name || "seu empreendimento";
  const roomName = reservation.room?.title || "sua acomodacao";
  const guestName = reservation.guest?.name || "hospede";
  const gender =
    settings.genderOverrides[getGenderKey(reservation)] || inferGender(guestName);
  const { welcome, pronoun } = getGreetingTarget(gender);
  const greeting = getGreeting();
  const hostName = settings.hostName || defaultSettings.hostName;
  const classification = getClassification(reservation);

  if (classification === "clariza") {
    return [
      [
        `Ola, ${greeting}!`,
        "",
        `Seja ${welcome} ao Condominio Edificio Clariza 🌎`,
        "",
        `Confirmada reserva no apartamento ${roomName}, com inicio em ${formatDate(
          reservation.checkinDate
        )} e termino em ${formatDate(reservation.checkoutDate)}.`,
        "",
        `Me chamo ${hostName}, estarei responsavel pelo acompanhamento da estadia e disponivel para qualquer suporte que se fizer necessario.`,
      ].join("\n"),
      [
        "Para garantir a seguranca e o conforto de todos, solicitamos o envio de uma foto do RG ou CNH dos ocupantes que acessarao o apartamento durante o periodo da reserva.",
        "",
        "Tal medida e indispensavel para a liberacao de acesso junto ao condominio e para evitar eventuais contratempos.",
      ].join("\n"),
      [
        "Regras do Condominio - Informacoes Importantes",
        "",
        "Prezados(as),",
        "",
        "Para garantir a boa convivencia e o cumprimento das normas do condominio, pedimos a gentileza de observar atentamente as orientacoes abaixo:",
        "",
        "1. Entrada e saida com malas",
        "A entrada e saida com malas devem ser feitas exclusivamente pela lateral do predio (entrada de pedestres).",
        "Nao e permitido utilizar a entrada social para esse fim.",
        "",
        "Atencao: o nao cumprimento dessa regra esta sujeito a multa conforme as normas do condominio.",
        "",
        "2. Localizacao da lixeira do condominio",
        "A lixeira esta localizada no acesso lateral interno.",
        "- De frente para os elevadores, siga pela saida para a area externa;",
        "- Logo a direita, no meio do corredor, encontram-se as lixeiras para descarte de lixo;",
        "- Seguindo um pouco mais a frente e virando a direita, ha um corredor que da acesso direto a saida lateral para a rua.",
        "",
        "3. Acesso pela porta lateral",
        "- Para entrar no condominio (da rua para dentro), e necessario utilizar a TAG;",
        "- Para sair do condominio (de dentro para a rua), ha um botao sinalizado ao lado da porta, que realiza a abertura automatica.",
        "",
        "Em caso de duvidas, estou a disposicao para ajudar.",
        "",
        "Agradecemos a compreensao e a colaboracao de todos.",
      ].join("\n"),
    ];
  }

  return [
    [
      `Ola, ${greeting}!`,
      "",
      `*Seja ${welcome} ao ${stayName}* 🌎`,
      `Sua reserva no studio *${roomName}* esta confirmada, com check-in no dia ${formatDate(
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

void getPresentationMessages;

function buildAccessData(reservation, settings) {
  const stayInfo = getStayInfo(settings, reservation);
  const staySecrets = getStaySecrets(settings, reservation);
  const roomInfo = getRoomInfo(settings, reservation);
  const roomSecrets = getRoomSecrets(settings, reservation);
  const reservationSecrets = getReservationSecrets(settings, reservation);

  return {
    address:
      roomInfo.address ||
      roomInfo.apartmentAddress ||
      stayInfo.address ||
      stayInfo.apartmentAddress ||
      "",
    pickupAddress: roomInfo.pickupAddress || stayInfo.pickupAddress || "",
    apartmentAddress:
      roomInfo.apartmentAddress ||
      stayInfo.apartmentAddress ||
      roomInfo.address ||
      stayInfo.address ||
      "",
    door1: reservationSecrets.door1 || roomSecrets.door1 || staySecrets.door1 || "",
    door2: reservationSecrets.door2 || roomSecrets.door2 || staySecrets.door2 || "",
    unitDoor: reservationSecrets.unitDoor || roomSecrets.unitDoor || "",
    wifiName: roomInfo.wifiName || stayInfo.wifiName || "",
    wifiPassword: roomInfo.wifiPassword || stayInfo.wifiPassword || "",
    keySafeCode:
      reservationSecrets.keySafeCode || roomSecrets.keySafeCode || staySecrets.keySafeCode || "",
    apartmentDoorCode:
      reservationSecrets.apartmentDoorCode || roomSecrets.apartmentDoorCode || "",
    tokenLabel: roomInfo.tokenLabel || stayInfo.tokenLabel || "token cinza",
  };
}

function StatusBadge({ status }) {
  const classes =
    status === "ativa"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : status === "concluida"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${classes}`}>
      {status}
    </span>
  );
}

function MessageBlock({ text, label }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          {label}
        </div>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(text)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] dark:border-slate-700"
        >
          Copiar
        </button>
      </div>
      <textarea
        readOnly
        value={text}
        className="min-h-[220px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />
    </div>
  );
}

function getAccessMessages(reservation, settings) {
  const classification = getClassification(reservation);
  const stayName = reservation.room?.stay?.name || "";
  const roomName = reservation.room?.title || "";
  const gender =
    settings.genderOverrides[getGenderKey(reservation)] ||
    inferGender(reservation.guest?.name);
  const { welcome } = getGreetingTarget(gender);
  const data = buildAccessData(reservation, settings);

  if (classification === "clariza") {
    return [
      [
        "Instrucoes para retirada das chaves - Edificio Clariza",
        "",
        "Para retirar suas chaves, siga ate:",
        `Endereco: ${data.pickupAddress || "Rua Tabapua, 909"}`,
        "",
        "1. No portao eletronico, digite o codigo:",
        `#*${data.door1}`,
        "Um som de liberacao sera emitido. Empurre rapidamente a porta.",
        "",
        '2. Ao entrar no hall, a sua direita, localize o armario com a imagem de "Bem-vindo" na porta.',
        "Abra e procure o cofre indicado.",
        "",
        "3. Digite a senha do cofre:",
        `${data.keySafeCode}`,
        "Retire o molho de chaves, feche o cofre e siga para o apartamento.",
      ].join("\n"),
      [
        "Acesso ao apartamento",
        `${roomName} - ${data.apartmentAddress || "Rua Tabapua, 925"}`,
        "Check-in: 16:00",
        "Check-out: 10:00",
        "",
        `1. Ao chegar na portaria, use o ${data.tokenLabel} para liberar o primeiro acesso.`,
        "2. Use o mesmo molho de chaves/token para liberar as duas portas de entrada do predio.",
        "3. Na porta do apartamento, ative a fechadura passando a palma da mao no visor.",
        `4. Digite o codigo do apartamento: ${data.apartmentDoorCode}`,
        "",
        "Wi-Fi:",
        `Rede: ${data.wifiName}`,
        `Senha: ${data.wifiPassword}`,
        "",
        "Tenha uma otima estadia!",
      ].join("\n"),
    ];
  }

  if (classification === "itaim") {
    return [[
      `Seja ${welcome} ao ${stayName}`,
      `${roomName}`,
      "Check-in: 16:00 | Check-out: 10:00",
      `Endereco: ${data.address}`,
      "",
      `1a porta de entrada do predio: digite o codigo compartilhado #*${data.door1}`,
      `2a porta de entrada: utilize o codigo especifico do hospede ${data.door2}`,
      `Porta do apartamento ${roomName}: utilize o codigo especifico do hospede ${data.unitDoor}`,
      "",
      "Ao sair do apartamento, encoste a mao no visor para acionar o fechamento.",
      `Wi-Fi: ${data.wifiName || "-"} / ${data.wifiPassword}`,
    ].join("\n")];
  }

  if (classification === "jk") {
    return [[
      `Seja ${welcome} ao ${stayName}`,
      `${roomName}`,
      "Check-in: 16:00 | Check-out: 10:00",
      `Endereco: ${data.address}`,
      "",
      `1a porta de entrada, na lateral do imovel: digite o codigo compartilhado #*${data.door1}`,
      `2a porta: utilize o codigo especifico do hospede ${data.door2}`,
      `Porta do apartamento ${roomName}: utilize o codigo especifico do hospede ${data.unitDoor}`,
      "",
      `Wi-Fi: ${data.wifiName || "-"} / ${data.wifiPassword}`,
    ].join("\n")];
  }

  if (classification === "internacional") {
    const floorHint = getInternacionalFloorHint(roomName);
    return [[
      `Seja ${welcome} ao ${stayName}`,
      `${roomName}`,
      "Check-in: 16:00 | Check-out: 10:00",
      `Endereco: ${data.address}`,
      "",
      `1a porta de entrada: localize o porteiro eletronico e insira o codigo compartilhado #*${data.door1}`,
      `2a porta: utilize o codigo especifico do hospede ${data.door2}`,
      floorHint,
      `Porta da acomodacao: utilize o codigo especifico do hospede ${data.unitDoor}`,
      "",
      `Wi-Fi: ${data.wifiName || "-"} / ${data.wifiPassword}`,
    ].filter(Boolean).join("\n")];
  }

  if (classification === "iguatemi-a" || classification === "iguatemi-b") {
    const wing = classification === "iguatemi-a" ? "A" : "B";
    const wingHint =
      classification === "iguatemi-a"
        ? "a esquerda da academia de Pilates"
        : "a direita da academia de Pilates, proxima a uma grande palmeira no final do imovel";
    const stairsHint = classification === "iguatemi-b" ? getIguatemiBStairsHint(roomName) : "";

    return [[
      `Seja ${welcome} ao ${stayName}`,
      `${roomName}`,
      "Check-in: 16:00 | Check-out: 10:00",
      `Endereco: ${data.address}`,
      "",
      "Importante: a entrada principal fica na Rua Dr. Roberto Kikawa, embora o endereco oficial seja Rua Butanta, 324.",
      `Chegando ao endereco, localize a entrada Iguatemi ${wing}, situada ${wingHint}.`,
      `1a porta: insira o codigo compartilhado #*${data.door1} e empurre a porta.`,
      `2a porta: passe a palma da mao no visor e insira o codigo especifico do hospede ${data.door2}.`,
      stairsHint,
      `No apartamento: dirija-se ao ${roomName} e repita o processo com o codigo especifico do hospede ${data.unitDoor}.`,
      "",
      `Wi-Fi: ${data.wifiName || "-"} / ${data.wifiPassword}`,
    ].filter(Boolean).join("\n")];
  }

  if (classification === "iguatemi-at") {
    return [[
      `Seja ${welcome} ao ${stayName}`,
      `${roomName}`,
      "Check-in: 16:00 | Check-out: 10:00",
      `Endereco: ${data.address}`,
      "",
      "Importante: a entrada principal fica na Rua Dr. Roberto Kikawa, embora o endereco oficial seja Rua Butanta, 324.",
      "Ao chegar, localize a entrada Iguatemi A, a esquerda da academia de Pilates.",
      `1a porta: digite o codigo compartilhado #*${data.door1} e empurre a porta.`,
      "Ao entrar, siga para a porta da esquerda.",
      `2a porta: passe a palma da mao sobre o visor e digite o codigo especifico do hospede ${data.door2}.`,
      `Porta do apartamento: dirija-se ao ${roomName} e insira o codigo especifico do hospede ${data.unitDoor}.`,
      "",
      `Wi-Fi: ${data.wifiName || "-"} / ${data.wifiPassword}`,
    ].join("\n")];
  }

  if (classification === "iguatemi-bt-15" || classification === "iguatemi-bt-16") {
    const direction =
      classification === "iguatemi-bt-15"
        ? "Ao entrar apos a 1a porta, a acomodacao 15 fica a esquerda."
        : "Ao entrar apos a 1a porta, a acomodacao 16 fica a direita.";

    return [[
      `Seja bem-vindo ao ${stayName}`,
      `${roomName}`,
      "Check-in: 16:00 | Check-out: 10:00",
      `Endereco: ${data.address}`,
      "",
      "Importante: a entrada principal fica na Rua Dr. Roberto Kikawa, embora o endereco oficial seja Rua Butanta, 324.",
      "Chegando ao endereco, localize a entrada Iguatemi B.",
      `1a porta: insira o codigo compartilhado #*${data.door1} e empurre a porta.`,
      direction,
      `2a porta: passe a palma da mao sobre o visor e insira o codigo especifico do hospede ${data.door2}.`,
      `No apartamento: dirija-se ao ${roomName} e repita o processo com o codigo especifico do hospede ${data.unitDoor}.`,
      "",
      `Wi-Fi: ${data.wifiName || "-"} / ${data.wifiPassword}`,
    ].join("\n")];
  }

  return [[
    `Acesso - ${stayName}`,
    `${roomName}`,
    "Check-in: 16:00 | Check-out: 10:00",
    `Endereco: ${data.address}`,
    "",
    `Primeira porta: #*${data.door1}`,
    `Segunda porta: ${data.door2}`,
    `Porta da acomodacao: ${data.unitDoor}`,
    "",
    `Wi-Fi: ${data.wifiName}`,
    `Senha: ${data.wifiPassword}`,
  ].join("\n")];
}

export default function GuestCheckins() {
  const api = useApi();
  const today = dayjs().format("YYYY-MM-DD");
  const [accessDate, setAccessDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [settings, setSettings] = useState(() => getStoredSettings());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [reservationsRes, roomsRes] = await Promise.all([api("/reservations"), api("/rooms")]);
        setReservations(reservationsRes || []);
        setRooms(roomsRes || []);
      } catch (err) {
        console.error("Erro ao carregar check-ins:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [api]);

  const roomMetaById = useMemo(
    () =>
      rooms.reduce((acc, room) => {
        acc[room.id] = room;
        return acc;
      }, {}),
    [rooms]
  );

  const accessReservations = useMemo(
    () =>
      sortReservations(
        reservations.filter(
          (reservation) =>
            reservation.status !== "cancelada" &&
            reservation.checkinDate &&
            sameDay(reservation.checkinDate, accessDate)
        ),
        roomMetaById
      ),
    [accessDate, reservations, roomMetaById]
  );

  const uniqueStays = useMemo(() => {
    const stays = new Map();
    rooms.forEach((room) => {
      if (room.stay?.name) stays.set(room.stay.name, room.stay);
    });
    reservations.forEach((reservation) => {
      if (reservation.room?.stay?.name && !stays.has(reservation.room.stay.name)) {
        stays.set(reservation.room.stay.name, reservation.room.stay);
      }
    });
    return [...stays.values()]
      .sort((a, b) => {
        const posDiff = (a.position ?? 9999) - (b.position ?? 9999);
        if (posDiff !== 0) return posDiff;
        return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
      })
      .map((stay) => stay.name);
  }, [reservations, rooms]);

  const handleSettingChange = (field, value) => {
    setSettings((prev) => {
      const next = { ...prev, [field]: value };
      saveSettings(next);
      return next;
    });
  };

  const updateSettingsBranch = (branch, key, field, value) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        [branch]: {
          ...prev[branch],
          [key]: {
            ...(prev[branch][key] || {}),
            [field]: value,
          },
        },
      };
      saveSettings(next);
      return next;
    });
  };

  const handleStayInfoChange = (stayName, field, value) =>
    updateSettingsBranch("stayInfo", stayName, field, value);
  const handleStaySecretChange = (stayName, field, value) =>
    updateSettingsBranch("staySecrets", stayName, field, value);
  const handleRoomInfoChange = (room, field, value) =>
    updateSettingsBranch("roomInfo", getRoomKey(room), field, value);
  const handleRoomSecretChange = (room, field, value) =>
    updateSettingsBranch("roomSecrets", getRoomKey(room), field, value);
  const handleReservationSecretChange = (reservation, field, value) =>
    updateSettingsBranch("reservationSecrets", reservation.id, field, value);

  const handleRoomAccessChange = (reservation, field, value) => {
    if (field === "door1" || field === "door2" || field === "unitDoor" || field === "keySafeCode") {
      handleReservationSecretChange(reservation, field, value);
      return;
    }
    if (field === "apartmentDoorCode") {
      handleRoomSecretChange(reservation.room, field, value);
      return;
    }
    handleRoomInfoChange(reservation.room, field, value);
  };

  const updateReservationStatus = async (reservation, newStatus) => {
    setSubmittingId(reservation.id);
    try {
      const updated = await api(`/reservations/${reservation.id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });

      setReservations((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (err) {
      console.error("Erro ao atualizar reserva:", err);
      alert("Erro ao atualizar reserva.");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Check-ins de hospedes</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Apresentacoes semanais e mensagens de acesso com filtros independentes.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900 lg:grid-cols-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Responsavel
          </div>
          <input
            value={settings.hostName}
            onChange={(e) => handleSettingChange("hostName", e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Data acessos
          </div>
          <input
            type="date"
            value={accessDate}
            onChange={(e) => setAccessDate(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-950/60 dark:text-slate-300">
          Enderecos e Wi-Fi foram separados dos codigos locais, mas tudo ainda e salvo neste navegador
          ate existir persistencia no backend.
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-400">
          Carregando check-ins...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr,0.8fr]">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Instrucoes de acesso do dia
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {formatFullDate(accessDate)} • {accessReservations.length} check-in(s)
                </p>
              </div>

              {accessReservations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Nenhuma reserva com check-in para esta data.
                </div>
              ) : (
                <div className="space-y-4">
                  {accessReservations.map((reservation) => {
                    const isActive = reservation.status === "ativa";

                    return (
                      <article
                        key={reservation.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/40"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                              {reservation.room?.stay?.name || "Sem empreendimento"}
                            </div>
                            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                              {reservation.guest?.name || "Hospede sem nome"}
                            </div>
                            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              {reservation.room?.title || "Sem acomodacao"}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <StatusBadge status={reservation.status} />
                            <button
                              type="button"
                              onClick={() =>
                                updateReservationStatus(
                                  reservation,
                                  isActive ? "agendada" : "ativa"
                                )
                              }
                              disabled={submittingId === reservation.id}
                              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                                isActive
                                  ? "bg-sky-700 hover:bg-sky-800"
                                  : "bg-cyan-600 hover:bg-cyan-700"
                              }`}
                            >
                              {submittingId === reservation.id
                                ? "Salvando..."
                                : isActive
                                ? "Reverter check-in"
                                : "Fazer check-in"}
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                          {getAccessMessages(reservation, settings).map((text, index) => (
                            <MessageBlock
                              key={`${reservation.id}-access-${index}`}
                              text={text}
                              label={`Instrucao ${index + 1}`}
                            />
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
            <section className="space-y-6">
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Informacoes por empreendimento
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Enderecos, Wi-Fi e dados estaveis do empreendimento.
                </p>

                <div className="mt-4 space-y-4">
                  {uniqueStays.map((stayName) => {
                    const stay = settings.stayInfo[stayName] || {};
                    const staySecrets = settings.staySecrets[stayName] || {};

                    return (
                      <div
                        key={stayName}
                        className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40"
                      >
                        <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          {stayName}
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          <input
                            value={stay.address || ""}
                            onChange={(e) => handleStayInfoChange(stayName, "address", e.target.value)}
                            placeholder="Endereco base"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                          />
                          <input
                            value={stay.pickupAddress || ""}
                            onChange={(e) =>
                              handleStayInfoChange(stayName, "pickupAddress", e.target.value)
                            }
                            placeholder="Endereco retirada chaves"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                          />
                          <input
                            value={stay.apartmentAddress || ""}
                            onChange={(e) =>
                              handleStayInfoChange(stayName, "apartmentAddress", e.target.value)
                            }
                            placeholder="Endereco apartamento"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                          />
                          <input
                            value={stay.wifiName || ""}
                            onChange={(e) => handleStayInfoChange(stayName, "wifiName", e.target.value)}
                            placeholder="Nome rede wifi"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                          />
                          <input
                            value={stay.wifiPassword || ""}
                            onChange={(e) =>
                              handleStayInfoChange(stayName, "wifiPassword", e.target.value)
                            }
                            placeholder="Senha wifi"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                          />
                          <input
                            value={stay.tokenLabel || ""}
                            onChange={(e) =>
                              handleStayInfoChange(stayName, "tokenLabel", e.target.value)
                            }
                            placeholder="Descricao do token/tag"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                          />
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-dashed border-slate-300 pt-4 dark:border-slate-700">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Codigos locais do empreendimento
                          </div>
                          <input
                            value={staySecrets.door1 || ""}
                            onChange={(e) => handleStaySecretChange(stayName, "door1", e.target.value)}
                            placeholder="Codigo porta 1 compartilhada"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                          />
                          <input
                            value={staySecrets.door2 || ""}
                            onChange={(e) => handleStaySecretChange(stayName, "door2", e.target.value)}
                            placeholder="Codigo porta 2 compartilhada, se existir"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                          />
                          <input
                            value={staySecrets.keySafeCode || ""}
                            onChange={(e) =>
                              handleStaySecretChange(stayName, "keySafeCode", e.target.value)
                            }
                            placeholder="Codigo cofre/chaves"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {accessReservations.length > 0 && (
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    Ajustes da acomodacao do dia
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Para a data filtrada, combine informacoes da unidade com codigos locais do hospede.
                  </p>

                  <div className="mt-4 space-y-4">
                    {accessReservations.map((reservation) => {
                      const room = getRoomConfig(settings, reservation);
                      const roomKey = getReservationRoomKey(reservation);

                      return (
                        <div
                          key={roomKey}
                          className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40"
                        >
                          <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            {reservation.room?.stay?.name} • {reservation.room?.title}
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            <input
                              value={room.address || ""}
                              onChange={(e) =>
                                handleRoomAccessChange(reservation, "address", e.target.value)
                              }
                              placeholder="Endereco especifico"
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              value={room.pickupAddress || ""}
                              onChange={(e) =>
                                handleRoomAccessChange(reservation, "pickupAddress", e.target.value)
                              }
                              placeholder="Endereco retirada chaves"
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              value={room.apartmentAddress || ""}
                              onChange={(e) =>
                                handleRoomAccessChange(reservation, "apartmentAddress", e.target.value)
                              }
                              placeholder="Endereco apartamento"
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              value={room.unitDoor || ""}
                              onChange={(e) =>
                                handleRoomAccessChange(reservation, "unitDoor", e.target.value)
                              }
                              placeholder="Codigo porta unidade"
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              value={room.wifiName || ""}
                              onChange={(e) =>
                                handleRoomAccessChange(reservation, "wifiName", e.target.value)
                              }
                              placeholder="Nome rede wifi"
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              value={room.wifiPassword || ""}
                              onChange={(e) =>
                                handleRoomAccessChange(reservation, "wifiPassword", e.target.value)
                              }
                              placeholder="Senha wifi"
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              value={room.keySafeCode || ""}
                              onChange={(e) =>
                                handleRoomAccessChange(reservation, "keySafeCode", e.target.value)
                              }
                              placeholder="Codigo cofre/chaves"
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              value={room.apartmentDoorCode || ""}
                              onChange={(e) =>
                                handleRoomAccessChange(reservation, "apartmentDoorCode", e.target.value)
                              }
                              placeholder="Codigo porta apartamento"
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              value={room.tokenLabel || ""}
                              onChange={(e) =>
                                handleRoomAccessChange(reservation, "tokenLabel", e.target.value)
                              }
                              placeholder="Descricao do token/tag"
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {accessReservations.length > 0 && (
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    Codigos locais do check-in do dia
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Use quando a 2a porta ou a senha da acomodacao mudam por hospede.
                  </p>

                  <div className="mt-4 space-y-4">
                    {accessReservations.map((reservation) => {
                      const secret = getReservationSecrets(settings, reservation);

                      return (
                        <div
                          key={`${reservation.id}-secrets`}
                          className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40"
                        >
                          <div className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            {reservation.room?.stay?.name} - {reservation.room?.title} - {reservation.guest?.name}
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            <input
                              value={secret.door2 || ""}
                              onChange={(e) =>
                                handleReservationSecretChange(reservation, "door2", e.target.value)
                              }
                              placeholder="Codigo 2a porta deste hospede"
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              value={secret.unitDoor || ""}
                              onChange={(e) =>
                                handleReservationSecretChange(reservation, "unitDoor", e.target.value)
                              }
                              placeholder="Codigo da porta da acomodacao deste hospede"
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              value={secret.apartmentDoorCode || ""}
                              onChange={(e) =>
                                handleReservationSecretChange(
                                  reservation,
                                  "apartmentDoorCode",
                                  e.target.value
                                )
                              }
                              placeholder="Codigo porta apartamento, se aplicavel"
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                            <input
                              value={secret.keySafeCode || ""}
                              onChange={(e) =>
                                handleReservationSecretChange(
                                  reservation,
                                  "keySafeCode",
                                  e.target.value
                                )
                              }
                              placeholder="Codigo cofre/chaves deste hospede, se aplicavel"
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
