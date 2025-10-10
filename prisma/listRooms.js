import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rooms = await prisma.room.findMany({
    select: { id: true, title: true, stayId: true }
  });

  console.log("=== Rooms cadastrados no banco ===");
  rooms.forEach(r => {
    console.log(`${r.title}  (id: ${r.id})  stayId: ${r.stayId}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
