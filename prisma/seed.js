/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("../src/utils/auth");
const { v4: uuid } = require("uuid");

const prisma = new PrismaClient();

// ---------- helpers ----------
const roomMap = {
  // ---- Itaim Stay (Tabapuã) ----
  "Topázio 02": "58ea17e0-5692-4e15-aa24-5c34c8906518",
  "Lírio 01": "13cab838-6d74-4f5e-9da5-5e1f164e699f",
  "Klein 03": "ac51ee14-392c-43dd-927a-c9582090ee9f",
  "Samambaia 04": "af77c8bf-5de4-48ec-b93f-c1338836dee1",
  "Girassol 05": "9117f2b3-3fe6-4f38-9565-2aabe5e353d2",

  // ---- Internacional Stay (Urussuí) ----
  "Tucano 01": "16aa60b9-ef95-4af3-93e3-442ea8532e38",
  "Canário 02": "77d4fc46-0b75-42d7-aa87-e1e338b9e46c",
  "Beija-flor 03": "d2e0f37b-d5b2-4c80-8a3c-7c7ff866fbea",
  "Arara 04": "0ac858b2-1b1b-443d-8751-27f62a36b291",
  "Guará 05": "e5cc3bb7-670d-486a-867d-0dd22f93eaf1",
  "Falcão 06": "0307cd5d-e03e-4aad-9896-4cd783e169a1",

  // ---- Londres/Tokyo/Taipei/Sidney/Roma etc (JK Stay?) ----
  "Toronto 01": "b1b3fb27-c169-4110-b235-a2f8698de4a4",
  "Londres 02": "960802e9-566e-4eb6-91e9-0482f9d6e3be",
  "Tokyo 03": "2689318f-e9c3-4bde-a5e3-16b3ceb9d0cd",
  "Taipei 04": "8e60749d-e9b6-4ac5-a6cf-2b58f3c91203",
  "Sidney 05": "c476a98b-1ae3-434f-a101-12e2e73185d6",
  "Roma 06": "3c54c156-0af3-43b4-bffa-f18186a401a3",
  "Lisboa 08": "04693117-ba52-45d2-98dc-dab21b9d6da5",
  "Miami 09": "334ef5e5-5d10-4b39-bb01-909c9d031ad8",
  "Paris 10": "a93f6b18-aacb-42ab-9141-1045a6e17f79",

  // ---- Iguatemi Stay A (Butantã) ----
  "Kotor 02": "b4b258d7-d2c8-4ed9-a4b3-e6faf93cc9eb",
  "Split 03": "8ee774ac-d184-4753-be56-10ec28d28fa5",
  "Hvar 04": "cc5961ec-f122-4069-b956-017b37edfeaf",
  "Lubiana 05": "2b3fa089-b174-4f2a-8db7-62fbb3d604a9",
  "Budapeste 06": "d09cbcb1-6079-45e3-8eaa-06d98aa39d27",

  // ---- Iguatemi Stay B (?) ----
  "Sarajevo 07": "c9d6a656-641e-4990-8539-04c4f8cbd4a3",
  "Amsterdam 08": "ca9af6fd-653c-4916-abbb-f20ece0161b2",
  "Berlim 09": "727b7c93-b52d-4c3e-a173-170877cd30cc",

  // ---- Outros ----
  "Apto 402": "ce748f89-8767-41f9-a1a6-26fa4cf22548",
  "Apto 802": "60ac7a43-3151-4a84-a6d2-eb62864d4826",
  "Cobertura 1902": "23eb77e8-a259-4e9d-8f1b-7e2e6f7b0692",

  // ---- Aliases para diferenças de escrita na planilha ----
  "Beija-Flor 03": "d2e0f37b-d5b2-4c80-8a3c-7c7ff866fbea", // alias
  "Saravejo 07": "c9d6a656-641e-4990-8539-04c4f8cbd4a3"    // alias
};

function parseBrDateToISO(dateStr) {
  // "DD/MM/YYYY" -> "YYYY-MM-DDT00:00:00.000Z"
  const [d, m, y] = dateStr.split("/").map((v) => parseInt(v, 10));
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}T00:00:00.000Z`;
}

async function findOrCreateGuestByNameInsensitive(name) {
  // evita duplicar quando muda capitalização
  let guest = await prisma.guest.findFirst({
    where: { name: { equals: name, mode: "insensitive" } }
  });
  if (!guest) {
    guest = await prisma.guest.create({
      data: { id: uuid(), name }
    });
  }
  return guest;
}

async function ensureReservationUnique({ guestId, roomId, checkinISO, checkoutISO }) {
  const existing = await prisma.reservation.findFirst({
    where: {
      guestId,
      roomId,
      checkinDate: new Date(checkinISO),
      checkoutDate: new Date(checkoutISO)
    }
  });
  return !!existing;
}

// ---------- dados: TODAS as reservas que você passou ----------
const reservas = [
  { guest: "Ana Lucia Prestes", room: "Sidney 05", checkin: "28/09/2025", checkout: "01/10/2025" },
  { guest: "Arley Carlos", room: "Canário 02", checkin: "29/09/2025", checkout: "01/10/2025" },
  { guest: "Christina Yukie Ichiki", room: "Tokyo 03", checkin: "29/09/2025", checkout: "02/10/2025" },
  { guest: "Christina Yukie Ichiki", room: "Taipei 04", checkin: "29/09/2025", checkout: "02/10/2025" },
  { guest: "Danyel Clinário", room: "Arara 04", checkin: "29/09/2025", checkout: "04/10/2025" },
  { guest: "Erik Scaramuça", room: "Klein 03", checkin: "29/09/2025", checkout: "02/10/2025" },
  { guest: "Gustavo Vale", room: "Falcão 06", checkin: "29/09/2025", checkout: "01/10/2025" },
  { guest: "Leticia", room: "Londres 02", checkin: "29/09/2025", checkout: "02/10/2025" },
  { guest: "Silva evandro", room: "Samambaia 04", checkin: "29/09/2025", checkout: "03/10/2025" },
  { guest: "evelise Fard", room: "Tucano 01", checkin: "30/09/2025", checkout: "02/10/2025" },
  { guest: "Filipe Aguiar", room: "Beija-Flor 03", checkin: "30/09/2025", checkout: "03/10/2025" },
  { guest: "Leonardo Santiago", room: "Miami 09", checkin: "30/09/2025", checkout: "02/10/2025" },
  { guest: "lesley bezerra", room: "Girassol 05", checkin: "30/09/2025", checkout: "02/10/2025" },
  { guest: "Sandra Wazir", room: "Guará 05", checkin: "30/09/2025", checkout: "10/10/2025" },
  { guest: "Bruna Bordini", room: "Lírio 01", checkin: "01/10/2025", checkout: "03/10/2025" },
  { guest: "Igor Silva de Lima", room: "Falcão 06", checkin: "01/10/2025", checkout: "03/10/2025" },
  { guest: "Rafael mesquita", room: "Topázio 02", checkin: "01/10/2025", checkout: "03/10/2025" },
  { guest: "Vanessa Sanches", room: "Lubiana 05", checkin: "01/10/2025", checkout: "05/10/2025" },
  { guest: "Victor Favaro", room: "Berlim 09", checkin: "01/10/2025", checkout: "04/10/2025" },
  { guest: "Alexia Vargas", room: "Sidney 05", checkin: "02/10/2025", checkout: "06/10/2025" },
  { guest: "Anna Claudia venancio", room: "Roma 06", checkin: "02/10/2025", checkout: "06/10/2025" },
  { guest: "Danielle Moreno", room: "Londres 02", checkin: "02/10/2025", checkout: "05/10/2025" },
  { guest: "filipe reis", room: "Paris 10", checkin: "02/10/2025", checkout: "05/10/2025" },
  { guest: "Luiz Santos", room: "Klein 03", checkin: "02/10/2025", checkout: "07/10/2025" },
  { guest: "Bianca Gill", room: "Lisboa 08", checkin: "03/10/2025", checkout: "06/10/2025" },
  { guest: "Vale Maria", room: "Samambaia 04", checkin: "03/10/2025", checkout: "11/10/2025" },
  { guest: "Leonardo Luiz Caetano", room: "Tokyo 03", checkin: "03/10/2025", checkout: "05/10/2025" },
  { guest: "Bianca Gill", room: "Lisboa 08", checkin: "03/10/2025", checkout: "06/10/2025" },
  { guest: "Karen Tamataya", room: "Beija-Flor 03", checkin: "03/10/2025", checkout: "05/10/2025" },
  { guest: "Caroline riberio", room: "Canário 02", checkin: "03/10/2025", checkout: "05/10/2025" },
  { guest: "Lana", room: "Lírio 01", checkin: "03/10/2025", checkout: "06/10/2025" },
  { guest: "Lais Aguiar", room: "Topázio 02", checkin: "04/10/2025", checkout: "08/10/2025" },
  { guest: "Carlos augusto", room: "Girassol 05", checkin: "05/10/2025", checkout: "10/10/2025" },
  { guest: "Ana Paula Lemos da Silva", room: "Tokyo 03", checkin: "05/10/2025", checkout: "12/10/2025" },
  { guest: "Joshua Akum", room: "Berlim 09", checkin: "05/10/2025", checkout: "08/10/2025" },
  { guest: "Liliane sant", room: "Lírio 01", checkin: "06/10/2025", checkout: "08/10/2025" },
  { guest: "Rodrigo Leone", room: "Londres 02", checkin: "06/10/2025", checkout: "08/10/2025" },
  { guest: "Ana Paula Ohanian Monteiro", room: "Canário 02", checkin: "06/10/2025", checkout: "08/10/2025" },
  { guest: "Renata Daumas", room: "Taipei 04", checkin: "06/10/2025", checkout: "10/10/2025" },
  { guest: "Bruno Teixeira", room: "Falcão 06", checkin: "06/10/2025", checkout: "17/10/2025" },
  { guest: "Honório menezes", room: "Arara 04", checkin: "06/10/2025", checkout: "08/10/2025" },
  { guest: "isla Becker", room: "Lisboa 08", checkin: "06/10/2025", checkout: "08/10/2025" },
  { guest: "Antônio Domingues", room: "Sidney 05", checkin: "06/10/2025", checkout: "08/10/2025" },
  { guest: "Hander", room: "Amsterdam 08", checkin: "06/10/2025", checkout: "08/10/2025" },
  { guest: "Kelly Bitencourt", room: "Kotor 02", checkin: "06/10/2025", checkout: "09/10/2025" },
  { guest: "Kelly Bitencourt", room: "Lubiana 05", checkin: "06/10/2025", checkout: "09/10/2025" },
  { guest: "Gabriel", room: "Toronto 01", checkin: "06/10/2025", checkout: "08/10/2025" },
  { guest: "Tatiana Blunk", room: "Tucano 01", checkin: "07/10/2025", checkout: "09/10/2025" },
  { guest: "Breno Azevedo", room: "Klein 03", checkin: "07/10/2025", checkout: "12/10/2025" },
  { guest: "Gustavo Arantes", room: "Roma 06", checkin: "07/10/2025", checkout: "09/10/2025" },
  { guest: "André", room: "Apto 402", checkin: "07/10/2025", checkout: "19/10/2025" },
  { guest: "Riller Ribeiro", room: "Canário 02", checkin: "08/10/2025", checkout: "10/10/2025" },
  { guest: "Riller Ribeiro", room: "Arara 04", checkin: "08/10/2025", checkout: "10/10/2025" },
  { guest: "Marcelo Santos Aguiar", room: "Beija-Flor 03", checkin: "08/10/2025", checkout: "16/10/2025" },
  { guest: "larissa costa", room: "Londres 02", checkin: "08/10/2025", checkout: "10/10/2025" },
  { guest: "Marcus vinicius", room: "Toronto 01", checkin: "08/10/2025", checkout: "15/10/2025" },
  { guest: "Klaus", room: "Berlim 09", checkin: "08/10/2025", checkout: "11/10/2025" },
  { guest: "Bruno Oliveira", room: "Cobertura 1902", checkin: "09/10/2025", checkout: "14/10/2025" },
  { guest: "Paulo Baquit", room: "Lírio 01", checkin: "09/10/2025", checkout: "12/10/2025" },
  { guest: "Cunha Edu", room: "Lisboa 08", checkin: "09/10/2025", checkout: "11/10/2025" },
  { guest: "Lais Castro", room: "Tucano 01", checkin: "09/10/2025", checkout: "11/10/2025" },
  { guest: "Dinilza", room: "Topázio 02", checkin: "10/10/2025", checkout: "13/10/2025" },
  { guest: "Daniel", room: "Berlim 09", checkin: "12/10/2025", checkout: "15/10/2025" },
  { guest: "Faustino pereira marques", room: "Split 03", checkin: "12/10/2025", checkout: "15/10/2025" },
  { guest: "Luiz Ricardo", room: "Samambaia 04", checkin: "13/10/2025", checkout: "22/10/2025" },
  { guest: "Victor Hugo", room: "Guará 05", checkin: "13/10/2025", checkout: "15/10/2025" },
  { guest: "Floriano Gardeli", room: "Arara 04", checkin: "13/10/2025", checkout: "16/10/2025" },
  { guest: "Carolina Spitalnik", room: "Cobertura 1902", checkin: "14/10/2025", checkout: "19/10/2025" },
  { guest: "Suely Crisóstomo da costa", room: "Lubiana 05", checkin: "14/10/2025", checkout: "19/10/2025" },
  { guest: "Alcides Daleffe", room: "Taipei 04", checkin: "14/10/2025", checkout: "16/10/2025" },
  { guest: "Yasmim de Jesus", room: "Lírio 01", checkin: "14/10/2025", checkout: "16/10/2025" },
  { guest: "Yasmim de Jesus", room: "Klein 03", checkin: "14/10/2025", checkout: "16/10/2025" },
  { guest: "Daniel Guolo", room: "Tucano 01", checkin: "14/10/2025", checkout: "16/10/2025" },
  { guest: "Claudio", room: "Canário 02", checkin: "14/10/2025", checkout: "16/10/2025" },
  { guest: "Gustavo Lell", room: "Girassol 05", checkin: "15/10/2025", checkout: "18/10/2025" },
  { guest: "Necy Kawamura", room: "Saravejo 07", checkin: "16/10/2025", checkout: "19/10/2025" },
  { guest: "Necy Kawamura", room: "Berlim 09", checkin: "16/10/2025", checkout: "19/10/2025" },
  { guest: "Antonio Rabello", room: "Lírio 01", checkin: "16/10/2025", checkout: "19/10/2025" },
  { guest: "Thi Nguyen", room: "Hvar 04", checkin: "16/10/2025", checkout: "18/10/2025" },
  { guest: "Tatiana Prado", room: "Topázio 02", checkin: "16/10/2025", checkout: "19/10/2025" },
  { guest: "Daniela Rebelatto Destro", room: "Guará 05", checkin: "17/10/2025", checkout: "19/10/2025" },
  { guest: "Luiz Martins", room: "Londres 02", checkin: "17/10/2025", checkout: "19/10/2025" },
  { guest: "Rafaela Ernesto", room: "Klein 03", checkin: "17/10/2025", checkout: "20/10/2025" },
  { guest: "Adone totti", room: "Canário 02", checkin: "18/10/2025", checkout: "24/10/2025" },
  { guest: "Calderón Bedoya", room: "Tucano 01", checkin: "18/10/2025", checkout: "26/10/2025" },
  { guest: "Regislaine Aparecida", room: "Topázio 02", checkin: "19/10/2025", checkout: "22/10/2025" },
  { guest: "Romana Furtado", room: "Lírio 01", checkin: "19/10/2025", checkout: "21/10/2025" },
  { guest: "Andrea Grifagni", room: "Girassol 05", checkin: "20/10/2025", checkout: "23/10/2025" },
  { guest: "Andrea Grifagni", room: "Klein 03", checkin: "20/10/2025", checkout: "23/10/2025" },
  { guest: "Baki Schahin", room: "Taipei 04", checkin: "20/10/2025", checkout: "22/10/2025" },
  { guest: "renata daumas", room: "Lisboa 08", checkin: "20/10/2025", checkout: "24/10/2025" },
  { guest: "Flavia Furlan", room: "Berlim 09", checkin: "21/10/2025", checkout: "23/10/2025" },
  { guest: "Thanilla", room: "Samambaia 04", checkin: "22/10/2025", checkout: "26/10/2025" },
  { guest: "Rafael Valverde", room: "Topázio 02", checkin: "23/10/2025", checkout: "25/10/2025" },
  { guest: "Juliana Trento", room: "Apto 402", checkin: "23/10/2025", checkout: "26/10/2025" },
  { guest: "Márcia Monte", room: "Lírio 01", checkin: "26/10/2025", checkout: "30/10/2025" },
  { guest: "Clemens Hubmann", room: "Samambaia 04", checkin: "27/10/2025", checkout: "29/10/2025" },
  { guest: "Calebe Bezerra", room: "Klein 03", checkin: "28/10/2025", checkout: "31/10/2025" },
  { guest: "Kadu Guillaume", room: "Girassol 05", checkin: "28/10/2025", checkout: "30/10/2025" },
  { guest: "Veronica Azevedo", room: "Canário 02", checkin: "28/10/2025", checkout: "31/10/2025" },
  { guest: "Caio Cobo", room: "Topázio 02", checkin: "28/10/2025", checkout: "31/10/2025" },
  { guest: "Grilo Carlos", room: "Tucano 01", checkin: "28/10/2025", checkout: "01/11/2025" },
  { guest: "Jean Guilpain", room: "Cobertura 1902", checkin: "29/10/2025", checkout: "02/11/2025" },
  { guest: "Maria Luiza Cardoso", room: "Apto 402", checkin: "29/10/2025", checkout: "02/11/2025" },
  { guest: "Romay mariano", room: "Lírio 01", checkin: "30/10/2025", checkout: "06/11/2025" },
  { guest: "Sidnei", room: "Topázio 02", checkin: "31/10/2025", checkout: "02/11/2025" },
  { guest: "Cristiano Cassini", room: "Apto 802", checkin: "31/10/2025", checkout: "02/11/2025" },
  { guest: "Nicolau Mônica", room: "Lubiana 05", checkin: "31/10/2025", checkout: "02/11/2025" },
  { guest: "Juliana Rosa", room: "Samambaia 04", checkin: "31/10/2025", checkout: "03/11/2025" },
  { guest: "Fernanda Santos", room: "Amsterdam 08", checkin: "31/10/2025", checkout: "03/11/2025" }
];

// ---------- seeders ----------
async function seedAdmin() {
  const email = "admin@stays.local";
  const exists = await prisma.staff.findUnique({ where: { email } });
  if (exists) {
    console.log("ℹ️ ADMIN já existe");
    return;
  }
  const passwordHash = await hashPassword("admin123"); // troque em produção
  await prisma.staff.create({
    data: {
      name: "Administrador",
      email,
      role: "ADMIN",
      active: true,
      passwordHash
    }
  });
  console.log("✅ ADMIN criado:", email, "| senha: admin123");
}

async function seedReservas() {
  let created = 0;
  let skipped = 0;
  let missingRooms = new Set();

  for (const r of reservas) {
    const roomId = roomMap[r.room];
    if (!roomId) {
      missingRooms.add(r.room);
      console.log(`⚠️ Quarto não mapeado: ${r.room}`);
      continue;
    }

    const checkinISO = parseBrDateToISO(r.checkin);
    const checkoutISO = parseBrDateToISO(r.checkout);

    const guest = await findOrCreateGuestByNameInsensitive(r.guest);

    const exists = await ensureReservationUnique({
      guestId: guest.id,
      roomId,
      checkinISO,
      checkoutISO
    });
    if (exists) {
      skipped++;
      continue;
    }

    await prisma.reservation.create({
      data: {
        id: uuid(),
        guestId: guest.id,
        roomId,
        checkinDate: new Date(checkinISO),
        checkoutDate: new Date(checkoutISO),
        status: "agendada",
        notes: ""
      }
    });

    created++;
    console.log(`✅ Reserva criada: ${r.guest} — ${r.room} (${r.checkin} → ${r.checkout})`);
  }

  if (missingRooms.size > 0) {
    console.log("\n⚠️ Atenção: há UHs sem mapeamento de ID:");
    console.log([...missingRooms].map((n) => ` - ${n}`).join("\n"));
  }

  console.log(`\nResumo reservas → criadas: ${created}, ignoradas (duplicadas): ${skipped}`);
}

// ---------- main ----------
async function main() {
  await seedAdmin();
  await seedReservas();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
