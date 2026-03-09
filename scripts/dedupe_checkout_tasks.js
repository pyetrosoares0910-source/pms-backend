const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = new Set(argv);
  const fromArg = argv.find((item) => item.startsWith("--from="));

  return {
    apply: args.has("--apply"),
    all: args.has("--all"),
    from: fromArg ? fromArg.slice("--from=".length) : null,
    strict: args.has("--strict"),
  };
}

function isValidDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getUtcDay(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const STAY_ALIAS_MAP = new Map([
  ["itaim stay", "itaim stay"],
  ["itaim stay tabapua", "itaim stay"],
  ["jk stay", "jk stay"],
  ["jk stay clodomiro", "jk stay"],
  ["jk lux stay", "jk stay"],
  ["internacional stay", "internacional stay"],
  ["internacional stay urussui", "internacional stay"],
  ["iguatemi stay a", "iguatemi stay a"],
  ["iguatemi stay a butanta", "iguatemi stay a"],
  ["iguatemi stay b", "iguatemi stay b"],
  ["iguatemi stay b butanta", "iguatemi stay b"],
  ["iguatemi stay a terreo", "iguatemi stay a terreo"],
  ["iguatemi stay a t", "iguatemi stay a terreo"],
]);

function canonicalStay(rawStay) {
  const normalized = normalizeText(rawStay);
  if (STAY_ALIAS_MAP.has(normalized)) {
    return STAY_ALIAS_MAP.get(normalized);
  }

  const withoutParens = normalizeText(String(rawStay || "").replace(/\([^)]*\)/g, " "));
  if (STAY_ALIAS_MAP.has(withoutParens)) {
    return STAY_ALIAS_MAP.get(withoutParens);
  }

  return withoutParens || normalized || "sem stay";
}

function canonicalRoom(rawRoom) {
  return normalizeText(rawRoom) || "sem quarto";
}

function buildWhereClause({ all, from }) {
  if (all) return {};

  const startDate = from || formatLocalDate(new Date());
  if (!isValidDateOnly(startDate)) {
    throw new Error("Parametro --from invalido. Use o formato YYYY-MM-DD.");
  }

  return {
    date: {
      gte: new Date(`${startDate}T00:00:00.000Z`),
    },
  };
}

function strictTaskKey(task) {
  const day = getUtcDay(task.date);
  return `${day}|${task.stay}|${task.rooms}`;
}

function smartTaskKey(task) {
  const day = getUtcDay(task.date);
  const stay = canonicalStay(task.stay);
  const room = canonicalRoom(task.rooms);
  return `${day}|${stay}|${room}`;
}

function chooseTaskToKeep(tasks) {
  const sorted = [...tasks].sort((a, b) => {
    const aAssigned = a.maidId !== null && a.maidId !== undefined ? 1 : 0;
    const bAssigned = b.maidId !== null && b.maidId !== undefined ? 1 : 0;
    if (aAssigned !== bAssigned) return bAssigned - aAssigned;
    return a.id.localeCompare(b.id);
  });

  return sorted[0];
}

function groupTasks(tasks, { strict }) {
  const groups = new Map();

  for (const task of tasks) {
    const key = strict ? strictTaskKey(task) : smartTaskKey(task);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(task);
  }

  return groups;
}

function collectDuplicateIds(groups) {
  const duplicateIds = [];
  const duplicatedGroups = [];

  for (const [key, items] of groups.entries()) {
    if (items.length <= 1) continue;

    const keep = chooseTaskToKeep(items);
    const remove = items.filter((item) => item.id !== keep.id);
    const assignedCount = items.filter(
      (item) => item.maidId !== null && item.maidId !== undefined
    ).length;

    duplicateIds.push(...remove.map((item) => item.id));
    duplicatedGroups.push({
      key,
      total: items.length,
      keepId: keep.id,
      keepMaidId: keep.maidId,
      removeIds: remove.map((item) => item.id),
      assignedCount,
    });
  }

  return { duplicateIds, duplicatedGroups };
}

async function deleteInBatches(ids, batchSize = 500) {
  let totalDeleted = 0;

  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    const result = await prisma.task.deleteMany({
      where: { id: { in: chunk } },
    });
    totalDeleted += result.count;
  }

  return totalDeleted;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const where = buildWhereClause(options);

  const tasks = await prisma.task.findMany({
    where,
    select: {
      id: true,
      date: true,
      stay: true,
      rooms: true,
      maidId: true,
    },
    orderBy: [{ date: "asc" }, { stay: "asc" }, { rooms: "asc" }, { id: "asc" }],
  });

  const groups = groupTasks(tasks, options);
  const { duplicateIds, duplicatedGroups } = collectDuplicateIds(groups);
  const groupsWithAssigned = duplicatedGroups.filter((g) => g.assignedCount > 0).length;

  console.log("=== DEDUPE CHECKOUT TASKS ===");
  console.log(`Escopo: ${options.all ? "todas as datas" : `desde ${options.from || formatLocalDate(new Date())}`}`);
  console.log(`Modo: ${options.strict ? "strict (dia+stay+quarto exatos)" : "smart (normaliza stay e quarto)"}`);
  console.log(`Total de tasks lidas: ${tasks.length}`);
  console.log(`Grupos com duplicidade: ${duplicatedGroups.length}`);
  console.log(`Tasks duplicadas removiveis: ${duplicateIds.length}`);
  console.log(`Grupos com diarista em alguma task: ${groupsWithAssigned}`);

  if (duplicatedGroups.length > 0) {
    console.log("\nAmostra (ate 15 grupos):");
    duplicatedGroups.slice(0, 15).forEach((group) => {
      console.log(
        `- ${group.key} | total=${group.total} | keep=${group.keepId} (maid=${group.keepMaidId ?? "null"}) | remove=${group.removeIds.length}`
      );
    });
  }

  if (!options.apply) {
    console.log("\nDry-run concluido. Nada foi apagado.");
    console.log("Para aplicar: node scripts/dedupe_checkout_tasks.js --apply");
    console.log("Para aplicar so no futuro desde hoje: node scripts/dedupe_checkout_tasks.js --apply");
    console.log("Para aplicar desde uma data: node scripts/dedupe_checkout_tasks.js --from=2026-03-09 --apply");
    console.log("Para aplicar em todas as datas: node scripts/dedupe_checkout_tasks.js --all --apply");
    console.log("Para modo estrito: node scripts/dedupe_checkout_tasks.js --strict");
    return;
  }

  if (duplicateIds.length === 0) {
    console.log("\nNenhuma duplicidade para apagar.");
    return;
  }

  const deletedCount = await deleteInBatches(duplicateIds);
  console.log(`\nAplicado com sucesso. Tasks removidas: ${deletedCount}`);
}

main()
  .catch((error) => {
    console.error("\nErro ao deduplicar tasks:", error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
