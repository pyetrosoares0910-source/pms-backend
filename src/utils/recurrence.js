const RRuleLib = require("rrule");
const { zonedTimeToUtc } = require("date-fns-tz");

const { RRule, RRuleSet } = RRuleLib;


// Map dias da semana para rrule
const WD = {
  SU: RRule.SU,
  MO: RRule.MO,
  TU: RRule.TU,
  WE: RRule.WE,
  TH: RRule.TH,
  FR: RRule.FR,
  SA: RRule.SA,
};

/**
 * Cria um conjunto de regras a partir do JSON salvo em recurrence.
 * Exemplo de recurrence:
 * { mode:"monthly_by_day", days:[28], startDate:"2025-10-01" }
 */
export function buildRules(recurrence, timezone = "America/Sao_Paulo") {
  if (!recurrence?.mode) throw new Error("Recurrence inválida");
  const { startDate, until, count } = recurrence;
  const dtstart = zonedTimeToUtc(new Date(startDate), timezone);

  const common = { dtstart, until: until ? new Date(until) : undefined, count };
  const set = new RRuleSet();

  switch (recurrence.mode) {
    case "monthly_by_day": {
      recurrence.days.forEach((day) => {
        set.rrule(new RRule({ ...common, freq: RRule.MONTHLY, bymonthday: [day] }));
      });
      return set;
    }

    case "monthly_twice": {
      recurrence.days.forEach((day) => {
        set.rrule(new RRule({ ...common, freq: RRule.MONTHLY, bymonthday: [day] }));
      });
      return set;
    }

    case "biweekly": {
      const anchor = recurrence.anchor
        ? zonedTimeToUtc(new Date(recurrence.anchor), timezone)
        : dtstart;
      set.rrule(new RRule({ ...common, dtstart: anchor, freq: RRule.DAILY, interval: 14 }));
      return set;
    }

    case "weekly": {
      const byweekday = (recurrence.weekdays || []).map((w) => WD[w]);
      set.rrule(
        new RRule({
          ...common,
          freq: RRule.WEEKLY,
          interval: recurrence.interval || 1,
          byweekday,
        })
      );
      return set;
    }

    case "yearly_firstWeek": {
      const byweekday = (recurrence.weekdays || []).map((w) => WD[w]);
      const bymonth = recurrence.months || [];
      set.rrule(
        new RRule({
          ...common,
          freq: RRule.YEARLY,
          bymonth,
          byweekday,
          bysetpos: 1, // primeira semana
        })
      );
      return set;
    }

    default:
      throw new Error("Modo de recorrência não suportado: " + recurrence.mode);
  }
}

/**
 * Gera as ocorrências dentro de um horizonte de tempo
 * @param {object} recurrence - regra JSON
 * @param {Date} horizonEnd - data final do horizonte
 * @param {string} timezone
 * @returns {Date[]} lista de datas
 */
export function generateOccurrences(recurrence, horizonEnd, timezone = "America/Sao_Paulo") {
  const set = buildRules(recurrence, timezone);
  const start = new Date(recurrence.startDate);
  const dates = set.between(start, horizonEnd, true);
  return dates;
}
