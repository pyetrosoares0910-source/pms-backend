const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = "admin@vz.com";
  const plainPassword = "vz@696700";
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const updated = await prisma.staff.upsert({
    where: { email },
    update: {
      passwordHash: hashedPassword, 
      role: "ADMIN",
      name: "Administrador VZ",
    },
    create: {
      name: "Administrador VZ",
      email,
      passwordHash: hashedPassword, 
      role: "ADMIN",
    },
  });

  console.log("✅ Admin atualizado/criado com sucesso!");
  console.log("📧 Email:", updated.email);
  console.log("🔑 Nova senha:", plainPassword);
}

main()
  .catch((e) => console.error("❌ Erro:", e))
  .finally(() => prisma.$disconnect());
