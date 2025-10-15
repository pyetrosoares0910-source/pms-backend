/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");
const { v4: uuid } = require("uuid");

const prisma = new PrismaClient();

// --- Mapa oficial de rooms (com aliases úteis) ---
const roomMap = {
  "Topázio 02": "58ea17e0-5692-4e15-aa24-5c34c8906518",
  "Lírio 01": "13cab838-6d74-4f5e-9da5-5e1f164e699f",
  "Klein 03": "ac51ee14-392c-43dd-927a-c9582090ee9f",
  "Samambaia 04": "af77c8bf-5de4-48ec-b93f-c1338836dee1",
  "Girassol 05": "9117f2b3-3fe6-4f38-9565-2aabe5e353d2",
  "Tucano 01": "16aa60b9-ef95-4af3-93e3-442ea8532e38",
  "Canário 02": "77d4fc46-0b75-42d7-aa87-e1e338b9e46c",
  "Beija-Flor 03": "d2e0f37b-d5b2-4c80-8a3c-7c7ff866fbea",
  "Beija-flor 03": "d2e0f37b-d5b2-4c80-8a3c-7c7ff866fbea", // alias
  "Arara 04": "0ac858b2-1b1b-443d-8751-27f62a36b291",
  "Guará 05": "e5cc3bb7-670d-486a-867d-0dd22f93eaf1",
  "Falcão 06": "0307cd5d-e03e-4aad-9896-4cd783e169a1",
  "Toronto 01": "b1b3fb27-c169-4110-b235-a2f8698de4a4",
  "Londres 02": "960802e9-566e-4eb6-91e9-0482f9d6e3be",
  "Tokyo 03": "2689318f-e9c3-4bde-a5e3-16b3ceb9d0cd",
  "Taipei 04": "8e60749d-e9b6-4ac5-a6cf-2b58f3c91203",
  "Sidney 05": "c476a98b-1ae3-434f-a101-12e2e73185d6",
  "Roma 06": "3c54c156-0af3-43b4-bffa-f18186a401a3",
  "Dubai 07": "74ea343c-04f6-4cfa-a788-56cef565dde9",
  "Lisboa 08": "04693117-ba52-45d2-98dc-dab21b9d6da5",
  "Miami 09": "334ef5e5-5d10-4b39-bb01-909c9d031ad8",
  "Paris 10": "a93f6b18-aacb-42ab-9141-1045a6e17f79",
  "Dubrovnik 01": "bd0387b9-3cbb-438e-8da9-b23164bcfce9",
  "Dubrovnik (DUB) 01": "bd0387b9-3cbb-438e-8da9-b23164bcfce9", // alias
  "Kotor 02": "b4b258d7-d2c8-4ed9-a4b3-e6faf93cc9eb",
  "Split 03": "8ee774ac-d184-4753-be56-10ec28d28fa5",
  "Hvar 04": "cc5961ec-f122-4069-b956-017b37edfeaf",
  "Lubiana 05": "2b3fa089-b174-4f2a-8db7-62fbb3d604a9",
  "Budapeste 06": "d09cbcb1-6079-45e3-8eaa-06d98aa39d27",
  "Sarajevo 07": "c9d6a656-641e-4990-8539-04c4f8cbd4a3",
  "Saravejo 07": "c9d6a656-641e-4990-8539-04c4f8cbd4a3", // alias
  "Amsterdam 08": "ca9af6fd-653c-4916-abbb-f20ece0161b2",
  "Berlim 09": "727b7c93-b52d-4c3e-a173-170877cd30cc",
  "Apto 402": "ce748f89-8767-41f9-a1a6-26fa4cf22548",
  "Apto 802": "60ac7a43-3151-4a84-a6d2-eb62864d4826",
  "Cobertura 1902": "23eb77e8-a259-4e9d-8f1b-7e2e6f7b0692"
};

function brToISO(dmy) {
  const [d, m, y] = dmy.split("/").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T00:00:00.000Z`;
}

async function findOrCreateGuest(name) {
  let guest = await prisma.guest.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (!guest) guest = await prisma.guest.create({ data: { id: uuid(), name } });
  return guest;
}

// 🔒 Duplicidade: mesma room + mesmas datas (independe do hóspede)
async function existsByRoomAndDates(roomId, checkinISO, checkoutISO) {
  const found = await prisma.reservation.findFirst({
    where: {
      roomId,
      checkinDate: new Date(checkinISO),
      checkoutDate: new Date(checkoutISO)
    }
  });
  return !!found;
}

// === DADOS: reservas posteriores (como enviado) ===
const reservas = [
  { guest: "Murilo Badalo", room: "Girassol 05", checkin: "02/11/2025", checkout: "04/11/2025" },
  { guest: "Roney Junqueira", room: "Klein 03", checkin: "02/11/2025", checkout: "04/11/2025" },
  { guest: "Sergio mendes", room: "Topázio 02", checkin: "02/11/2025", checkout: "04/11/2025" },
  { guest: "Alex Ferreira", room: "Samambaia 04", checkin: "04/11/2025", checkout: "06/11/2025" },
  { guest: "Macarena Barriá", room: "Apto 802", checkin: "04/11/2025", checkout: "10/11/2025" },
  { guest: "Jony Ilson da silva", room: "Guará 05", checkin: "05/11/2025", checkout: "11/11/2025" },
  { guest: "Marcos Resnik", room: "Canário 02", checkin: "05/11/2025", checkout: "10/11/2025" },
  { guest: "Marcos Resnik", room: "Tucano 01", checkin: "05/11/2025", checkout: "10/11/2025" },
  { guest: "ricardo Garcia", room: "Apto 402", checkin: "05/11/2025", checkout: "09/11/2025" },
  { guest: "Alexandre Cronemberger", room: "Klein 03", checkin: "06/11/2025", checkout: "11/11/2025" },
  { guest: "Alexandre Cronemberger", room: "Girassol 05", checkin: "06/11/2025", checkout: "11/11/2025" },
  { guest: "Bruno Kamada", room: "Falcão 06", checkin: "06/11/2025", checkout: "09/11/2025" },
  { guest: "Daniel Girardi", room: "Cobertura 1902", checkin: "06/11/2025", checkout: "10/11/2025" },
  { guest: "Jose Hernan Gallo", room: "Toronto 01", checkin: "06/11/2025", checkout: "10/11/2025" },
  { guest: "Leonardo Monteiro Muniz", room: "Roma 06", checkin: "06/11/2025", checkout: "13/11/2025" },
  { guest: "Marcio Komoto", room: "Lírio 01", checkin: "06/11/2025", checkout: "10/11/2025" },
  { guest: "Miriam Namiko", room: "Taipei 04", checkin: "06/11/2025", checkout: "09/11/2025" },
  { guest: "Renata Albuquerque", room: "Topázio 02", checkin: "06/11/2025", checkout: "10/11/2025" },
  { guest: "Alan Santos de Abreu", room: "Budapeste 06", checkin: "07/11/2025", checkout: "10/11/2025" },
  { guest: "Arthur MAciel", room: "Dubrovnik (DUB) 01", checkin: "07/11/2025", checkout: "09/11/2025" },
  { guest: "Bruno Frederico", room: "Paris 10", checkin: "07/11/2025", checkout: "10/11/2025" },
  { guest: "Camila Maciel", room: "Lubiana 05", checkin: "07/11/2025", checkout: "09/11/2025" },
  { guest: "Daniel Borato", room: "Lisboa 08", checkin: "07/11/2025", checkout: "10/11/2025" },
  { guest: "èder Junior", room: "Londres 02", checkin: "07/11/2025", checkout: "10/11/2025" },
  { guest: "Fabyano Souza", room: "Tokyo 03", checkin: "07/11/2025", checkout: "10/11/2025" },
  { guest: "Marcos Arantes", room: "Amsterdam 08", checkin: "07/11/2025", checkout: "09/11/2025" },
  { guest: "Roberval Costa", room: "Samambaia 04", checkin: "07/11/2025", checkout: "10/11/2025" },
  { guest: "Maxi Varela", room: "Beija-Flor 03", checkin: "07/11/2025", checkout: "10/11/2025" },
  { guest: "Maxi Varela", room: "Arara 04", checkin: "07/11/2025", checkout: "10/11/2025" },
  { guest: "Daniel Borato", room: "Lisboa 08", checkin: "07/11/2025", checkout: "10/11/2025" }, // repetido na fonte; regra de duplicidade cuida
  { guest: "èder Junior", room: "Londres 02", checkin: "07/11/2025", checkout: "10/11/2025" },   // repetido
  { guest: "Ulisses Fetter", room: "Sidney 05", checkin: "07/11/2025", checkout: "10/11/2025" },
  { guest: "Rodrigo Cunha", room: "Dubai 07", checkin: "07/11/2025", checkout: "10/11/2025" },
  { guest: "Fabyano Souza", room: "Tokyo 03", checkin: "07/11/2025", checkout: "10/11/2025" },   // repetido
  { guest: "Bruno Frederico", room: "Paris 10", checkin: "07/11/2025", checkout: "10/11/2025" },  // repetido
  { guest: "Isac Martinello", room: "Miami 09", checkin: "07/11/2025", checkout: "10/11/2025" },
  { guest: "MAriana paio", room: "Berlim 09", checkin: "08/11/2025", checkout: "13/11/2025" },
  { guest: "Evandro Leite", room: "Apto 802", checkin: "10/11/2025", checkout: "13/11/2025" },
  { guest: "Domenico Trindade", room: "Topázio 02", checkin: "10/11/2025", checkout: "13/11/2025" },
  { guest: "rodrigo Monteiro", room: "Samambaia 04", checkin: "11/11/2025", checkout: "13/11/2025" },
  { guest: "Juliana Paiva", room: "Topázio 02", checkin: "13/11/2025", checkout: "16/11/2025" },
  { guest: "Neto Medeiros", room: "Tucano 01", checkin: "13/11/2025", checkout: "17/11/2025" },
  { guest: "Neto Medeiros", room: "Canário 02", checkin: "13/11/2025", checkout: "17/11/2025" },
  { guest: "Marcelo Magalhães", room: "Saravejo 07", checkin: "13/11/2025", checkout: "16/11/2025" },
  { guest: "Helena Bezzan Rodrigues Alves", room: "Cobertura 1902", checkin: "14/11/2025", checkout: "17/11/2025" },
  { guest: "Édipo Albuquerque", room: "Hvar 04", checkin: "16/11/2025", checkout: "23/11/2025" },
  { guest: "Evandro Leite", room: "Apto 802", checkin: "17/11/2025", checkout: "20/11/2025" },
  { guest: "Rafaela Andrade", room: "Cobertura 1902", checkin: "19/11/2025", checkout: "24/11/2025" },
  { guest: "Gabriel Vanzuita", room: "Toronto 01", checkin: "19/11/2025", checkout: "24/11/2025" },
  { guest: "Livia", room: "Berlim 09", checkin: "19/11/2025", checkout: "23/11/2025" },
  { guest: "Marta Maia de Miranda", room: "Girassol 05", checkin: "19/11/2025", checkout: "24/11/2025" },
  { guest: "Alfredo", room: "Samambaia 04", checkin: "19/11/2025", checkout: "21/11/2025" },
  { guest: "Mauricio Peixoto", room: "Saravejo 07", checkin: "20/11/2025", checkout: "25/11/2025" },
  { guest: "REgina Eirado", room: "Amsterdam 08", checkin: "20/11/2025", checkout: "24/11/2025" },
  { guest: "Dylan Della Pasqua", room: "Kotor 02", checkin: "20/11/2025", checkout: "25/11/2025" },
  { guest: "Joana kramer", room: "Lírio 01", checkin: "20/11/2025", checkout: "22/11/2025" },
  { guest: "Joana kramer", room: "Klein 03", checkin: "20/11/2025", checkout: "22/11/2025" },
  { guest: "Guilherme Goetze", room: "Lubiana 05", checkin: "20/11/2025", checkout: "23/11/2025" },
  { guest: "Marina Bordin", room: "Apto 802", checkin: "21/11/2025", checkout: "23/11/2025" },
  { guest: "Gabriel Ribeiro", room: "Canário 02", checkin: "21/11/2025", checkout: "25/11/2025" },
  { guest: "Matheus Vedana", room: "Samambaia 04", checkin: "21/11/2025", checkout: "25/11/2025" },
  { guest: "caio Oliveira", room: "Londres 02", checkin: "21/11/2025", checkout: "24/11/2025" },
  { guest: "Camilla castro", room: "Tucano 01", checkin: "21/11/2025", checkout: "23/11/2025" },
  { guest: "NAtalia Eckstein", room: "Topázio 02", checkin: "22/11/2025", checkout: "24/11/2025" },
  { guest: "Jade Ormondes", room: "Taipei 04", checkin: "22/11/2025", checkout: "25/11/2025" },
  { guest: "Rafaela Almeida", room: "Lírio 01", checkin: "22/11/2025", checkout: "24/11/2025" },
  { guest: "Igor de Souza Soares", room: "Lubiana 05", checkin: "23/11/2025", checkout: "29/11/2025" },
  { guest: "Pablo Colatarci", room: "Klein 03", checkin: "23/11/2025", checkout: "27/11/2025" },
  { guest: "Evandro Leite", room: "Apto 802", checkin: "24/11/2025", checkout: "27/11/2025" },
  { guest: "Cristina", room: "Samambaia 04", checkin: "25/11/2025", checkout: "27/11/2025" },
  { guest: "ana lucia prestes", room: "Sidney 05", checkin: "28/11/2025", checkout: "01/12/2025" },
  { guest: "Kadu Guillaume", room: "Topázio 02", checkin: "09/12/2025", checkout: "11/12/2025" },
  { guest: "Kristi Vlahos", room: "Cobertura 1902", checkin: "10/12/2025", checkout: "15/12/2025" },
  { guest: "ADriana Flavia", room: "Cobertura 1902", checkin: "16/12/2025", checkout: "19/12/2025" },
  { guest: "Charles Silva", room: "Cobertura 1902", checkin: "30/12/2025", checkout: "02/01/2026" },
  { guest: "Fabiola Ramos", room: "Topázio 02", checkin: "02/01/2026", checkout: "06/01/2026" },
  { guest: "Bernardo Uchôa", room: "Samambaia 04", checkin: "29/01/2026", checkout: "01/02/2026" }
];

async function main() {
  let created = 0, skipped = 0, missing = new Set();

  for (const r of reservas) {
    const roomId = roomMap[r.room];
    if (!roomId) {
      missing.add(r.room);
      console.log(`⚠️ UH não mapeada: ${r.room}`);
      continue;
    }
    const checkinISO = brToISO(r.checkin);
    const checkoutISO = brToISO(r.checkout);

    // Duplicidade por room+datas
    if (await existsByRoomAndDates(roomId, checkinISO, checkoutISO)) {
      skipped++;
      continue;
    }

    const guest = await findOrCreateGuest(r.guest);

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
    console.log(`✅ ${r.guest} — ${r.room} (${r.checkin} → ${r.checkout})`);
    created++;
  }

  if (missing.size) {
    console.log("\n⚠️ UHs sem ID no mapa:");
    for (const n of missing) console.log(" -", n);
  }
  console.log(`\nResumo → criadas: ${created}, ignoradas (duplicadas por room+datas): ${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { prisma.$disconnect(); });
