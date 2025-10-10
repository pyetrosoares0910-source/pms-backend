const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("Admin@123", 10);

  await prisma.staff.create({
    data: {
      name: "Admin",
      role: "ADMIN",
      email: "admin@pms.local",
      password: hashedPassword,
      active: true,
    },
  });

  console.log("Admin criado com sucesso!");
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
  });
