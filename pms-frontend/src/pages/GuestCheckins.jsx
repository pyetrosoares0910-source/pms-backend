import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useApi } from "../lib/api";

dayjs.extend(utc);

const SETTINGS_KEY = "guest-checkins-settings-v2";

const defaultSettings = {
  hostName: "Pyetro",
  genderOverrides: {},
  stayAccess: {},
  roomAccess: {},
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

function getStoredSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    return {
      hostName: parsed.hostName || defaultSettings.hostName,
      genderOverrides: parsed.genderOverrides || {},
      stayAccess: parsed.stayAccess || {},
      roomAccess: parsed.roomAccess || {},
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
  return (
    reservation.room?.id ||
    `${reservation.room?.stay?.name || "sem-stay"}|${reservation.room?.title || reservation.id}`
  );
}

function getStayConfig(settings, reservation) {
  return settings.stayAccess[reservation.room?.stay?.name || ""] || {};
}

function getRoomConfig(settings, reservation) {
  return settings.roomAccess[getReservationRoomKey(reservation)] || {};
}

function sortReservations(items) {
  return [...items].sort((a, b) => {
    const dateCompare = dayjs.utc(a.checkinDate).valueOf() - dayjs.utc(b.checkinDate).valueOf();
    if (dateCompare !== 0) return dateCompare;

    const stayCompare = String(a.room?.stay?.name || "").localeCompare(
      String(b.room?.stay?.name || ""),
      "pt-BR"
    );
    if (stayCompare !== 0) return stayCompare;

    const roomCompare = String(a.room?.title || "").localeCompare(
      String(b.room?.title || ""),
      "pt-BR"
    );
    if (roomCompare !== 0) return roomCompare;

    return String(a.guest?.name || "").localeCompare(
      String(b.guest?.name || ""),
      "pt-BR"
    );
  });
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

function buildAccessData(reservation, settings) {
  const stay = getStayConfig(settings, reservation);
  const room = getRoomConfig(settings, reservation);
  return {
    address: room.address || room.apartmentAddress || stay.address || stay.apartmentAddress || "",
    pickupAddress: room.pickupAddress || stay.pickupAddress || "",
    apartmentAddress: room.apartmentAddress || stay.apartmentAddress || room.address || stay.address || "",
    door1: room.door1 || stay.door1 || "",
    door2: room.door2 || stay.door2 || "",
    unitDoor: room.unitDoor || "",
    wifiName: room.wifiName || "",
    wifiPassword: room.wifiPassword || stay.wifiPassword || "",
    keySafeCode: room.keySafeCode || stay.keySafeCode || "",
    apartmentDoorCode: room.apartmentDoorCode || "",
    tokenLabel: room.tokenLabel || "token cinza",
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
        "Instrucoes para retirada das chaves - Itaim Stay",
        "",
        "Para retirar suas chaves, siga ate:",
        `📍${data.pickupAddress || "Rua Tabapua, 909"}`,
        "",
        "* No portao eletronico, digite o codigo:",
        `#*${data.door1}`,
        "(Um som de liberacao sera emitido - empurre rapidamente a porta para abrir)",
        "",
        '* Ao entrar no hall, a sua direita, localize o armario com a imagem de "Bem-vindo" na porta.',
        "Abra e procure o cofre numero 5.",
        "",
        "* Digite a senha:",
        `${data.keySafeCode}`,
        "para destravar e retirar o molho de chaves.",
        "",
        "* Feche o cofre, aperte o botao no armario para sair do local e dirija-se ao proximo endereco.",
      ].join("\n"),
      [
        "Acesso ao apartamento",
        `${roomName} - ${data.apartmentAddress || "Rua Tabapua, 925"}`,
        "Check-in: 16:00",
        "Check-out: 10:00",
        "",
        `* Ao chegar na portaria, use o ${data.tokenLabel} para liberar o portao eletronico.`,
        "* Entre no elevador e siga ate o apartamento.",
        "* Na porta do apto, abrir as duas fechaduras com as chaves. Em seguida, passe a palma da mao sobre o visor da fechadura para ativa-la.",
        `* Digite o codigo: *${data.apartmentDoorCode}`,
        "(aguarde o som de liberacao e puxe a macaneta).",
        "",
        "A porta tranca automaticamente ao ser encostada corretamente.",
        "Para sair, pressione o botao branco da fechadura e aguarde a liberacao. (Nao girar manualmente)",
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
      `*${welcome.charAt(0).toUpperCase() + welcome.slice(1)} ao ${stayName}*🌎`,
      `*${roomName}*`,
      "Check-in 16:00 - Check-out 10:00",
      `Endereco: ${data.address}`,
      "",
      `• Ao chegar ao endereco, dirija-se a porta de entrada. Para abrir digite o codigo: #*${data.door1}`,
      `• Prossiga para a proxima porta e insira o codigo: ${data.door2}`,
      `• Direcione-se ao apartamento ${roomName} e repita o processo inserindo o codigo: ${data.unitDoor}`,
      "",
      "Ao sair do apartamento, lembre-se de encostar a mao no visor da fechadura para acionar seu fechamento.",
      `• A senha do wi-fi e: ${data.wifiPassword}`,
      "",
      "Tenha uma otima estadia.",
    ].join("\n")];
  }

  if (classification === "jk") {
    return [[
      `*${welcome.charAt(0).toUpperCase() + welcome.slice(1)} ao ${stayName}*🌎`,
      `*${roomName}*`,
      "Check-in 16:00 - Check-out 10:00",
      `Endereco: ${data.address}`,
      "",
      `* Chegando ao endereco, dirija-se a porta de entrada na lateral do imovel e insira o codigo: #*${data.door1}`,
      `* Prossiga para a proxima porta e insira o codigo: ${data.door2}`,
      `* Direcione-se ao apartamento ${roomName} e repita o processo inserindo o codigo: ${data.unitDoor}`,
      "",
      `* A Senha do WiFi e: ${data.wifiPassword}`,
      "",
      "Tenha uma otima estadia!",
    ].join("\n")];
  }

  if (classification === "internacional") {
    return [[
      `*Seja ${welcome} ao ${stayName}* 🌎`,
      `*${roomName}*`,
      "Check-in 16:00 - Check-out 10:00",
      `Endereco: ${data.address}`,
      "",
      `* Chegando ao endereco, localize o porteiro eletronico e insira o codigo: #*${data.door1}`,
      `* Prossiga para a proxima porta e insira a senha: ${data.door2}`,
      `* Na entrada do studio, repita o processo inserindo a senha: ${data.unitDoor}`,
      "",
      `* A Senha do WiFi e: ${data.wifiPassword}`,
      "",
      "Tenha uma otima estadia!",
    ].join("\n")];
  }

  if (classification === "iguatemi-a" || classification === "iguatemi-b") {
    const wing = classification === "iguatemi-a" ? "A" : "B";
    const wingHint =
      classification === "iguatemi-a"
        ? "a esquerda da academia de Pilates"
        : "a direita da academia de Pilates, proxima a uma grande palmeira no final do imovel";

    return [[
      `*${welcome.charAt(0).toUpperCase() + welcome.slice(1)} ao ${stayName}* 🌎`,
      `*${roomName}*`,
      "Check-in: 16:00 | Check-out: 10:00",
      `Endereco: ${data.address}`,
      "",
      "Importante: A entrada principal do imovel esta localizada na Rua Dr. Roberto Kikawa, mas o endereco oficial e na Rua Butanta, 324.",
      "",
      "Como acessar o apartamento:",
      `* Chegando ao endereco: Localize a entrada Iguatemi ${wing}, situada ${wingHint}.`,
      `* Primeira porta: insira o codigo #*${data.door1} e empurre a porta.`,
      `* Segunda porta: passe a palma da mao no visor e insira o codigo ${data.door2}.`,
      `* No apartamento: dirija-se ao ${roomName} e repita o processo com o codigo ${data.unitDoor}.`,
      "",
      "Ao sair do apartamento, toque no visor da fechadura para acionar a trava de seguranca.",
      "",
      "Informacoes de Wi-Fi:",
      `Rede: ${data.wifiName}`,
      `Senha: ${data.wifiPassword}`,
      "",
      "Desejo-lhe uma otima estadia!",
    ].join("\n")];
  }

  if (classification === "iguatemi-at") {
    return [[
      `*${welcome.charAt(0).toUpperCase() + welcome.slice(1)} ao ${stayName}* 🌎`,
      `*${roomName}*`,
      "Check-in: 16:00",
      "Check-out: 10:00",
      `Endereco: ${data.address}`,
      "",
      "Importante: A entrada principal do imovel fica pela Rua Dr. Roberto Kikawa, embora o endereco oficial seja Rua Butanta, 324.",
      "Ao chegar ao local, localize a entrada Iguatemi A, situada a esquerda da academia de Pilates.",
      `Primeira porta: digite o codigo #*${data.door1} e empurre a porta.`,
      "Ao entrar, siga para a porta da esquerda.",
      `Segunda porta: passe a palma da mao sobre o visor e digite o codigo ${data.door2}.`,
      `Porta do apartamento: dirija-se ao ${roomName} e insira o codigo ${data.unitDoor}.`,
      "",
      "Ao sair do apartamento, toque no visor da fechadura para acionar a trava de seguranca.",
      "",
      "Wi-Fi:",
      `Rede: ${data.wifiName}`,
      `Senha: ${data.wifiPassword}`,
      "",
      "Desejamos uma otima estadia!",
    ].join("\n")];
  }

  if (classification === "iguatemi-bt-15" || classification === "iguatemi-bt-16") {
    const direction =
      classification === "iguatemi-bt-15"
        ? "Ao entrar, localize a porta a sua esquerda."
        : "Ao entrar, localize a porta a sua direita, passando pelo WC.";

    return [[
      `Bem-vindo ao ${stayName} 🌎`,
      `${roomName}`,
      "Check-in: 16:00 | Check-out: 10:00",
      `Endereco: ${data.address}`,
      "",
      "Importante: A entrada principal do imovel esta localizada na Rua Dr. Roberto Kikawa, embora o endereco oficial seja Rua Butanta, 324.",
      "",
      "Como acessar o apartamento:",
      "Chegando ao endereco: localize a entrada Iguatemi B, situada a direita da academia de Pilates, proxima a uma grande palmeira no final do imovel.",
      `Primeira porta: para abrir, insira o codigo #*${data.door1} e empurre a porta.`,
      direction,
      `Segunda porta: passe a palma da mao sobre o visor e insira o codigo ${data.door2}.`,
      `No apartamento: dirija-se ao ${roomName} e repita o processo com o codigo ${data.unitDoor}.`,
      "",
      "Ao sair do apartamento, toque no visor da fechadura para acionar a trava de seguranca.",
      "",
      "Informacoes de Wi-Fi:",
      `Rede: ${data.wifiName}`,
      `Senha: ${data.wifiPassword}`,
      "",
      "Desejamos uma otima estadia!",
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
  const [presentationStartDate, setPresentationStartDate] = useState(today);
  const [accessDate, setAccessDate] = useState(today);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [settings, setSettings] = useState(() => getStoredSettings());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const reservationsRes = await api("/reservations");
        setReservations(reservationsRes || []);
      } catch (err) {
        console.error("Erro ao carregar check-ins:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [api]);

  const presentationEndDate = useMemo(
    () => dayjs(presentationStartDate).add(7, "day").format("YYYY-MM-DD"),
    [presentationStartDate]
  );

  const weeklyPresentationReservations = useMemo(() => {
    const start = dayjs(presentationStartDate).startOf("day");
    const end = dayjs(presentationStartDate).add(7, "day").endOf("day");
    return sortReservations(
      reservations.filter((reservation) => {
        if (reservation.status === "cancelada" || !reservation.checkinDate) return false;
        const checkin = dayjs.utc(reservation.checkinDate);
        return (
          checkin.isAfter(start.subtract(1, "millisecond")) &&
          checkin.isBefore(end.add(1, "millisecond"))
        );
      })
    );
  }, [presentationStartDate, reservations]);

  const accessReservations = useMemo(
    () =>
      sortReservations(
        reservations.filter(
          (reservation) =>
            reservation.status !== "cancelada" &&
            reservation.checkinDate &&
            sameDay(reservation.checkinDate, accessDate)
        )
      ),
    [accessDate, reservations]
  );

  const groupedWeeklyPresentations = useMemo(() => {
    const groups = {};
    weeklyPresentationReservations.forEach((reservation) => {
      const key = dayjs.utc(reservation.checkinDate).format("YYYY-MM-DD");
      if (!groups[key]) groups[key] = [];
      groups[key].push(reservation);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [weeklyPresentationReservations]);

  const uniqueStays = useMemo(() => {
    const names = new Set();
    reservations.forEach((reservation) => {
      if (reservation.room?.stay?.name) names.add(reservation.room.stay.name);
    });
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [reservations]);

  const handleSettingChange = (field, value) => {
    setSettings((prev) => {
      const next = { ...prev, [field]: value };
      saveSettings(next);
      return next;
    });
  };

  const handleStayAccessChange = (stayName, field, value) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        stayAccess: {
          ...prev.stayAccess,
          [stayName]: {
            ...(prev.stayAccess[stayName] || {}),
            [field]: value,
          },
        },
      };
      saveSettings(next);
      return next;
    });
  };

  const handleRoomAccessChange = (reservation, field, value) => {
    const key = getReservationRoomKey(reservation);
    setSettings((prev) => {
      const next = {
        ...prev,
        roomAccess: {
          ...prev.roomAccess,
          [key]: {
            ...(prev.roomAccess[key] || {}),
            [field]: value,
          },
        },
      };
      saveSettings(next);
      return next;
    });
  };

  const handleGenderOverride = (reservation, value) => {
    const key = getGenderKey(reservation);
    setSettings((prev) => {
      const next = {
        ...prev,
        genderOverrides: {
          ...prev.genderOverrides,
          [key]: value,
        },
      };
      saveSettings(next);
      return next;
    });
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
            Inicio apresentacoes
          </div>
          <input
            type="date"
            value={presentationStartDate}
            onChange={(e) => setPresentationStartDate(e.target.value)}
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
          Senhas, codigos e ajustes de genero ficam salvos apenas neste navegador.
        </div>
      </section>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-400">
          Carregando check-ins...
        </div>
      ) : (
        <>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-900">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Apresentacoes da semana
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Janela de {formatFullDate(presentationStartDate)} ate {formatFullDate(presentationEndDate)}
              </p>
            </div>

            {groupedWeeklyPresentations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Nenhuma reserva com check-in dentro desta janela de 8 dias.
              </div>
            ) : (
              <div className="space-y-6">
                {groupedWeeklyPresentations.map(([dateKey, items]) => (
                  <div key={dateKey} className="space-y-4">
                    <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                      {formatFullDate(dateKey)} • {items.length} check-in(s)
                    </div>

                    {items.map((reservation) => {
                      const genderValue =
                        settings.genderOverrides[getGenderKey(reservation)] ||
                        inferGender(reservation.guest?.name);

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
                                {reservation.room?.title || "Sem acomodacao"} • {formatDate(
                                  reservation.checkinDate
                                )} a {formatDate(reservation.checkoutDate)}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <StatusBadge status={reservation.status} />
                              <select
                                value={genderValue}
                                onChange={(e) => handleGenderOverride(reservation, e.target.value)}
                                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                              >
                                <option value="feminine">Texto feminino</option>
                                <option value="masculine">Texto masculino</option>
                              </select>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                            {getPresentationMessages(reservation, settings).map((text, index) => (
                              <MessageBlock
                                key={`${reservation.id}-presentation-${index}`}
                                text={text}
                                label={`Mensagem ${index + 1}`}
                              />
                            ))}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </section>

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
                  Dados por empreendimento
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Codigos compartilhados por empreendimento.
                </p>

                <div className="mt-4 space-y-4">
                  {uniqueStays.map((stayName) => {
                    const stay = settings.stayAccess[stayName] || {};
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
                            onChange={(e) => handleStayAccessChange(stayName, "address", e.target.value)}
                            placeholder="Endereco base"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                          />
                          <input
                            value={stay.pickupAddress || ""}
                            onChange={(e) =>
                              handleStayAccessChange(stayName, "pickupAddress", e.target.value)
                            }
                            placeholder="Endereco retirada chaves"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                          />
                          <input
                            value={stay.apartmentAddress || ""}
                            onChange={(e) =>
                              handleStayAccessChange(stayName, "apartmentAddress", e.target.value)
                            }
                            placeholder="Endereco apartamento"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                          />
                          <input
                            value={stay.door1 || ""}
                            onChange={(e) => handleStayAccessChange(stayName, "door1", e.target.value)}
                            placeholder="Codigo porta 1"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                          />
                          <input
                            value={stay.door2 || ""}
                            onChange={(e) => handleStayAccessChange(stayName, "door2", e.target.value)}
                            placeholder="Codigo porta 2"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                          />
                          <input
                            value={stay.wifiPassword || ""}
                            onChange={(e) =>
                              handleStayAccessChange(stayName, "wifiPassword", e.target.value)
                            }
                            placeholder="Senha wifi padrao"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                          />
                          <input
                            value={stay.keySafeCode || ""}
                            onChange={(e) =>
                              handleStayAccessChange(stayName, "keySafeCode", e.target.value)
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
                    Ajustes da unidade
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Use para wifi, porta da unidade e excecoes como Clariza, 15 e 16.
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
            </section>
          </div>
        </>
      )}
    </div>
  );
}
