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

const frequencyDurationDays = {
  DAILY: 1,
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
  QUARTERLY: 90,
  SEMIANNUAL: 180,
  YEARLY: 365,
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

function getFrequencyDurationDays({ frequency, customIntervalDays }) {
  if (frequency === "CUSTOM_DAYS") {
    const days = Number(customIntervalDays);
    if (!Number.isInteger(days) || days <= 0) {
      throw new Error("customIntervalDays deve ser um inteiro maior que zero.");
    }
    return days;
  }

  const days = frequencyDurationDays[frequency];
  if (!days) {
    throw new Error("Frequencia de tarefa periodica invalida.");
  }
  return days;
}

function getExecutionWindow(periodicTask) {
  const targetDate = toUtcDay(periodicTask.nextExecutionDate);
  if (!targetDate) {
    throw new Error("Proxima execucao invalida.");
  }

  const durationDays = getFrequencyDurationDays(periodicTask);
  const toleranceDays = Math.floor(durationDays * 0.5);

  return {
    targetDate,
    earliestDate: new Date(targetDate.getTime() - toleranceDays * MS_PER_DAY),
    latestDate: new Date(targetDate.getTime() + toleranceDays * MS_PER_DAY),
    durationDays,
    toleranceDays,
  };
}

module.exports = {
  calculateNextExecutionDate,
  getExecutionWindow,
  getFrequencyDurationDays,
  toUtcDay,
};
