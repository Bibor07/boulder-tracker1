export type AggregationMode =
  | "week"
  | "month"
  | "quarter"
  | "year";

export type AggregatedValue = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  value: number;
};

export type AggregatedAverage = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  value: number;
  count: number;
};

type DateRange = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
};

function toIsoDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseIsoDate(value: string) {
  const [year, month, day] = value
    .slice(0, 10)
    .split("-")
    .map(Number);

  return new Date(year, month - 1, day);
}

function formatMonthLabel(
  year: number,
  monthIndex: number
) {
  return new Intl.DateTimeFormat("de-DE", {
    month: "short",
    year: "numeric",
  }).format(new Date(year, monthIndex, 1));
}

function getIsoWeekData(date: Date) {
  const workingDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const day =
    workingDate.getDay() === 0
      ? 7
      : workingDate.getDay();

  workingDate.setDate(
    workingDate.getDate() + 4 - day
  );

  const weekYear =
    workingDate.getFullYear();

  const yearStart = new Date(
    weekYear,
    0,
    1
  );

  const weekNumber = Math.ceil(
    ((workingDate.getTime() -
      yearStart.getTime()) /
      86400000 +
      1) /
      7
  );

  return {
    weekYear,
    weekNumber,
  };
}

function getWeekStart(date: Date) {
  const result = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const day =
    result.getDay() === 0
      ? 7
      : result.getDay();

  result.setDate(
    result.getDate() - day + 1
  );

  return result;
}

function getWeekRange(date: Date): DateRange {
  const start = getWeekStart(date);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const { weekYear, weekNumber } =
    getIsoWeekData(date);

  const paddedWeek = String(
    weekNumber
  ).padStart(2, "0");

  return {
    key: `${weekYear}-W${paddedWeek}`,
    label: `KW ${weekNumber} ${weekYear}`,
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
}

function getMonthRange(
  date: Date
): DateRange {
  const year = date.getFullYear();
  const month = date.getMonth();

  const start = new Date(
    year,
    month,
    1
  );

  const end = new Date(
    year,
    month + 1,
    0
  );

  return {
    key: `${year}-${String(
      month + 1
    ).padStart(2, "0")}`,

    label: formatMonthLabel(
      year,
      month
    ),

    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
}

function getQuarterRange(
  date: Date
): DateRange {
  const year = date.getFullYear();

  const quarter =
    Math.floor(date.getMonth() / 3) + 1;

  const startMonth =
    (quarter - 1) * 3;

  const start = new Date(
    year,
    startMonth,
    1
  );

  const end = new Date(
    year,
    startMonth + 3,
    0
  );

  return {
    key: `${year}-Q${quarter}`,
    label: `Q${quarter} ${year}`,
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
}

function getYearRange(
  date: Date
): DateRange {
  const year = date.getFullYear();

  return {
    key: year.toString(),
    label: year.toString(),
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
}

export function getAggregationRange(
  isoDate: string,
  mode: AggregationMode
): DateRange {
  const date = parseIsoDate(isoDate);

  if (mode === "week") {
    return getWeekRange(date);
  }

  if (mode === "month") {
    return getMonthRange(date);
  }

  if (mode === "quarter") {
    return getQuarterRange(date);
  }

  return getYearRange(date);
}

export function formatAggregationMode(
  mode: AggregationMode
) {
  if (mode === "week") {
    return "Woche";
  }

  if (mode === "month") {
    return "Monat";
  }

  if (mode === "quarter") {
    return "Quartal";
  }

  return "Jahr";
}

/**
 * Addiert Werte innerhalb des gewählten
 * Zeitraums.
 *
 * Geeignet für:
 * - Anzahl Boulder
 * - Anzahl Sessions
 * - Sätze
 * - Wiederholungen
 * - Trainingszeit
 * - Trainingsvolumen
 */
export function aggregateSum<T>(
  items: T[],
  getDate: (item: T) => string,
  getValue: (item: T) => number,
  mode: AggregationMode
): AggregatedValue[] {
  const grouped = new Map<
    string,
    AggregatedValue
  >();

  items.forEach((item) => {
    const date = getDate(item);

    if (!date) {
      return;
    }

    const value = Number(
      getValue(item)
    );

    if (!Number.isFinite(value)) {
      return;
    }

    const range = getAggregationRange(
      date,
      mode
    );

    const current = grouped.get(
      range.key
    );

    if (current) {
      current.value += value;
      return;
    }

    grouped.set(range.key, {
      ...range,
      value,
    });
  });

  return Array.from(
    grouped.values()
  ).sort((a, b) =>
    a.startDate.localeCompare(
      b.startDate
    )
  );
}

/**
 * Bildet den Mittelwert innerhalb des
 * gewählten Zeitraums.
 *
 * Geeignet für:
 * - Durchschnittsgrad
 * - durchschnittliche Sessions je Boulder
 * - durchschnittliches Gewicht
 */
export function aggregateAverage<T>(
  items: T[],
  getDate: (item: T) => string,
  getValue: (item: T) =>
    | number
    | undefined
    | null,
  mode: AggregationMode
): AggregatedAverage[] {
  const grouped = new Map<
    string,
    {
      range: DateRange;
      sum: number;
      count: number;
    }
  >();

  items.forEach((item) => {
    const date = getDate(item);

    if (!date) {
      return;
    }

    const value = getValue(item);

    if (
      value === undefined ||
      value === null ||
      !Number.isFinite(Number(value))
    ) {
      return;
    }

    const range = getAggregationRange(
      date,
      mode
    );

    const current = grouped.get(
      range.key
    );

    if (current) {
      current.sum += Number(value);
      current.count += 1;
      return;
    }

    grouped.set(range.key, {
      range,
      sum: Number(value),
      count: 1,
    });
  });

  return Array.from(grouped.values())
    .map((group) => ({
      ...group.range,
      value:
        group.count > 0
          ? group.sum / group.count
          : 0,
      count: group.count,
    }))
    .sort((a, b) =>
      a.startDate.localeCompare(
        b.startDate
      )
    );
}

/**
 * Verwendet den chronologisch letzten
 * Wert innerhalb eines Zeitraums.
 *
 * Geeignet für:
 * - Gewicht
 * - KFA
 * - BMI
 */
export function aggregateLast<T>(
  items: T[],
  getDate: (item: T) => string,
  getValue: (item: T) => number,
  mode: AggregationMode
): AggregatedValue[] {
  const sorted = [...items].sort(
    (a, b) =>
      getDate(a).localeCompare(
        getDate(b)
      )
  );

  const grouped = new Map<
    string,
    AggregatedValue
  >();

  sorted.forEach((item) => {
    const date = getDate(item);

    if (!date) {
      return;
    }

    const value = Number(
      getValue(item)
    );

    if (!Number.isFinite(value)) {
      return;
    }

    const range = getAggregationRange(
      date,
      mode
    );

    grouped.set(range.key, {
      ...range,
      value,
    });
  });

  return Array.from(
    grouped.values()
  ).sort((a, b) =>
    a.startDate.localeCompare(
      b.startDate
    )
  );
}

export function roundOne(
  value: number
) {
  return Math.round(value * 10) / 10;
}