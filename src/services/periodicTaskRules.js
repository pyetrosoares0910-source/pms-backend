const rules = [
  {
    name: "maxDailyLoad",
    condition: ({ maidDailyLoad }) => maidDailyLoad > 3,
    action: "blockExtraTasks",
    message: "Diarista com mais de 3 acomodacoes no dia.",
  },
];

function evaluatePeriodicTaskAssignment(context, activeRules = rules) {
  const blockedBy = activeRules.filter(
    (rule) => rule.action === "blockExtraTasks" && rule.condition(context)
  );

  return {
    allowed: blockedBy.length === 0,
    blockedBy: blockedBy.map(({ name, message, action }) => ({ name, message, action })),
  };
}

module.exports = {
  evaluatePeriodicTaskAssignment,
  rules,
};
