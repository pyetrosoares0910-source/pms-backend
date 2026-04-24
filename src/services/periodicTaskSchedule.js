const MS_PER_DAY = 24 * 60 * 60 * 1000;

const frequencyIntervals = {
  DAILY: { days: 1 },
  WEEKLY: { days: 7 },
  BIWEEKLY: { days: 14 },
  MONTHLY: { months: 1 },
  QUARTERLY: { months: 3 },
  SEMIANNUAL: { months: 6 },
  YEARLY: { years: 1 },
};

function toUtcDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addCalendarInterval(date, interval) {
  const next = new Date(date);

  if (interval.days) {
    next.setUTCDate(next.getUTCDate() + interval.days);
  }
  if (interval.months) {
    next.setUTCMonth(next.getUTCMonth() + interval.months);
  }
  if (interval.years) {
    next.setUTCFullYear(next.getUTCFullYear() + interval.years);
  }

  return next;
}

function calculateNextExecutionDate({
  frequency,
  customIntervalDays,
  fromDate = new Date(),
}) {
  const baseDate = toUtcDay(fromDate);
  if (!baseDate) {
    throw new Error("Data base invalida para calculo da proxima execucao.");
  }

  if (frequency === "CUSTOM_DAYS") {
    const days = Number(customIntervalDays);
    if (!Number.isInteger(days) || days <= 0) {
      throw new Error("customIntervalDays deve ser um inteiro maior que zero.");
    }
    return new Date(baseDate.getTime() + days * MS_PER_DAY);
  }

  const interval = frequencyIntervals[frequency];
  if (!interval) {
    throw new Error("Frequencia de tarefa periodica invalida.");
  }

  return addCalendarInterval(baseDate, interval);
}

module.exports = {
  calculateNextExecutionDate,
  toUtcDay,
};
