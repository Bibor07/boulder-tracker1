import type {
  BoulderGrade,
  BoulderStyle,
  DiaryExercise,
} from "../../db/types";

export type TrendRangeDays =
  | 30
  | 90
  | 180
  | 365;

export type DatedBoulderItem = {
  item: DiaryExercise;
  date: string;
};

export type TrendValue = {
  current: number;
  previous: number;
  difference: number;
  percentChange: number | null;
  status:
    | "increase"
    | "decrease"
    | "unchanged"
    | "new"
    | "insufficient";
};

export type AverageTrendValue = TrendValue & {
  currentCount: number;
  previousCount: number;
};

export type FlashRateTrendValue = {
  currentRate: number;
  previousRate: number;
  differencePoints: number;
  currentCount: number;
  previousCount: number;
  status:
    | "increase"
    | "decrease"
    | "unchanged"
    | "insufficient";
};

export type TrendPeriod = {
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
};

export type GradeCountTrend = {
  grade: BoulderGrade;
  trend: TrendValue;
};

export type StyleGradeCountTrend = {
  style: BoulderStyle;
  grade: BoulderGrade;
  trend: TrendValue;
};

export type StyleAverageGradeTrend = {
  style: BoulderStyle;
  trend: AverageTrendValue;
};

export type GradeFlashRateTrend = {
  grade: BoulderGrade;
  trend: FlashRateTrendValue;
};

export type StyleGradeFlashRateTrend = {
  style: BoulderStyle;
  grade: BoulderGrade;
  trend: FlashRateTrendValue;
};

export type SessionsTrendValue = {
  current: number;
  previous: number;
  difference: number;
  percentChange: number | null;

  currentCount: number;
  previousCount: number;

  status:
    | "increase"
    | "decrease"
    | "unchanged"
    | "insufficient";
};

export type GradeSessionsTrend = {
  grade: BoulderGrade;
  trend: SessionsTrendValue;
};

export type StyleGradeSessionsTrend = {
  style: BoulderStyle;
  grade: BoulderGrade;
  trend: SessionsTrendValue;
};

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(
  date: Date,
  days: number
) {
  const result = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  result.setDate(
    result.getDate() + days
  );

  return result;
}

export function getTrendPeriod(
  days: TrendRangeDays,
  referenceDate = new Date()
): TrendPeriod {
  const currentEnd = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );

  const currentStart = addDays(
    currentEnd,
    -(days - 1)
  );

  const previousEnd = addDays(
    currentStart,
    -1
  );

  const previousStart = addDays(
    previousEnd,
    -(days - 1)
  );

  return {
    currentStart: toIsoDate(currentStart),
    currentEnd: toIsoDate(currentEnd),
    previousStart: toIsoDate(previousStart),
    previousEnd: toIsoDate(previousEnd),
  };
}

export function filterCurrentTrendPeriod(
  items: DatedBoulderItem[],
  period: TrendPeriod
) {
  return items.filter(
    ({ date }) =>
      date >= period.currentStart &&
      date <= period.currentEnd
  );
}

export function filterPreviousTrendPeriod(
  items: DatedBoulderItem[],
  period: TrendPeriod
) {
  return items.filter(
    ({ date }) =>
      date >= period.previousStart &&
      date <= period.previousEnd
  );
}

export function createCountTrend(
  current: number,
  previous: number,
  minimumCurrent = 1,
  minimumPrevious = 1
): TrendValue {
  if (
    current < minimumCurrent ||
    previous < minimumPrevious
  ) {
    if (
      previous === 0 &&
      current >= minimumCurrent
    ) {
      return {
        current,
        previous,
        difference: current - previous,
        percentChange: null,
        status: "new",
      };
    }

    return {
      current,
      previous,
      difference: current - previous,
      percentChange: null,
      status: "insufficient",
    };
  }

  const difference =
    current - previous;

  const percentChange = roundOne(
    (difference / previous) * 100
  );

  return {
    current,
    previous,
    difference,
    percentChange,

    status:
      difference > 0
        ? "increase"
        : difference < 0
        ? "decrease"
        : "unchanged",
  };
}

function calculateAverageGrade(
  items: DatedBoulderItem[]
) {
  const grades = items
    .map(({ item }) => item.boulderGrade)
    .filter(
      (
        grade
      ): grade is BoulderGrade =>
        grade !== undefined
    );

  if (grades.length === 0) {
    return {
      average: 0,
      count: 0,
    };
  }

  return {
    average: roundOne(
      grades.reduce(
        (sum, grade) => sum + grade,
        0
      ) / grades.length
    ),

    count: grades.length,
  };
}

export function createAverageGradeTrend(
  currentItems: DatedBoulderItem[],
  previousItems: DatedBoulderItem[],
  minimumCount = 3
): AverageTrendValue {
  const current =
    calculateAverageGrade(currentItems);

  const previous =
    calculateAverageGrade(previousItems);

  if (
    current.count < minimumCount ||
    previous.count < minimumCount
  ) {
    return {
      current: current.average,
      previous: previous.average,
      difference: roundOne(
        current.average -
          previous.average
      ),
      percentChange: null,
      currentCount: current.count,
      previousCount: previous.count,
      status: "insufficient",
    };
  }

  const difference = roundOne(
    current.average -
      previous.average
  );

  const percentChange =
    previous.average === 0
      ? null
      : roundOne(
          (difference /
            previous.average) *
            100
        );

  return {
    current: current.average,
    previous: previous.average,
    difference,
    percentChange,
    currentCount: current.count,
    previousCount: previous.count,

    status:
      difference > 0
        ? "increase"
        : difference < 0
        ? "decrease"
        : "unchanged",
  };
}

function calculateFlashRate(
  items: DatedBoulderItem[]
) {
  const itemsWithFlashInformation =
    items.filter(
      ({ item }) =>
        item.isFlash !== undefined
    );

  if (
    itemsWithFlashInformation.length === 0
  ) {
    return {
      rate: 0,
      count: 0,
    };
  }

  const flashes =
    itemsWithFlashInformation.filter(
      ({ item }) =>
        item.isFlash === true
    ).length;

  return {
    rate: roundOne(
      (flashes /
        itemsWithFlashInformation.length) *
        100
    ),

    count:
      itemsWithFlashInformation.length,
  };
}

export function createFlashRateTrend(
  currentItems: DatedBoulderItem[],
  previousItems: DatedBoulderItem[],
  minimumCount = 5
): FlashRateTrendValue {
  const current =
    calculateFlashRate(currentItems);

  const previous =
    calculateFlashRate(previousItems);

  if (
    current.count < minimumCount ||
    previous.count < minimumCount
  ) {
    return {
      currentRate: current.rate,
      previousRate: previous.rate,
      differencePoints: roundOne(
        current.rate - previous.rate
      ),
      currentCount: current.count,
      previousCount: previous.count,
      status: "insufficient",
    };
  }

  const differencePoints = roundOne(
    current.rate - previous.rate
  );

  return {
    currentRate: current.rate,
    previousRate: previous.rate,
    differencePoints,
    currentCount: current.count,
    previousCount: previous.count,

    status:
      differencePoints > 0
        ? "increase"
        : differencePoints < 0
        ? "decrease"
        : "unchanged",
  };
}

export function createGradeCountTrends(
  currentItems: DatedBoulderItem[],
  previousItems: DatedBoulderItem[],
  grades: BoulderGrade[]
): GradeCountTrend[] {
  return grades.map((grade) => {
    const current =
      currentItems.filter(
        ({ item }) =>
          item.boulderGrade === grade
      ).length;

    const previous =
      previousItems.filter(
        ({ item }) =>
          item.boulderGrade === grade
      ).length;

    return {
      grade,

      trend: createCountTrend(
        current,
        previous,
        2,
        2
      ),
    };
  });
}

export function createStyleGradeCountTrends(
  currentItems: DatedBoulderItem[],
  previousItems: DatedBoulderItem[],
  styles: BoulderStyle[],
  grades: BoulderGrade[]
): StyleGradeCountTrend[] {
  const result:
    StyleGradeCountTrend[] = [];

  styles.forEach((style) => {
    grades.forEach((grade) => {
      const current =
        currentItems.filter(
          ({ item }) =>
            item.boulderStyle === style &&
            item.boulderGrade === grade
        ).length;

      const previous =
        previousItems.filter(
          ({ item }) =>
            item.boulderStyle === style &&
            item.boulderGrade === grade
        ).length;

      if (
        current === 0 &&
        previous === 0
      ) {
        return;
      }

      result.push({
        style,
        grade,

        trend: createCountTrend(
          current,
          previous,
          2,
          2
        ),
      });
    });
  });

  return result;
}

export function createStyleAverageGradeTrends(
  currentItems: DatedBoulderItem[],
  previousItems: DatedBoulderItem[],
  styles: BoulderStyle[]
): StyleAverageGradeTrend[] {
  return styles
    .map((style) => {
      const currentStyleItems =
        currentItems.filter(
          ({ item }) =>
            item.boulderStyle === style
        );

      const previousStyleItems =
        previousItems.filter(
          ({ item }) =>
            item.boulderStyle === style
        );

      if (
        currentStyleItems.length === 0 &&
        previousStyleItems.length === 0
      ) {
        return null;
      }

      return {
        style,

        trend: createAverageGradeTrend(
          currentStyleItems,
          previousStyleItems,
          3
        ),
      };
    })
    .filter(
      (
        item
      ): item is StyleAverageGradeTrend =>
        item !== null
    );
}

function calculateAverageSessions(
  items: DatedBoulderItem[]
) {
  const sessionValues = items
    .map(({ item }) => item.boulderSessions)
    .filter(
      (
        value
      ): value is number =>
        value !== undefined &&
        Number.isFinite(Number(value)) &&
        Number(value) >= 1
    )
    .map(Number);

  if (sessionValues.length === 0) {
    return {
      average: 0,
      count: 0,
    };
  }

  return {
    average: roundOne(
      sessionValues.reduce(
        (sum, value) => sum + value,
        0
      ) / sessionValues.length
    ),

    count: sessionValues.length,
  };
}

export function createSessionsTrend(
  currentItems: DatedBoulderItem[],
  previousItems: DatedBoulderItem[],
  minimumCount = 2
): SessionsTrendValue {
  const current =
    calculateAverageSessions(currentItems);

  const previous =
    calculateAverageSessions(previousItems);

  const difference = roundOne(
    current.average - previous.average
  );

  if (
    current.count < minimumCount ||
    previous.count < minimumCount
  ) {
    return {
      current: current.average,
      previous: previous.average,
      difference,
      percentChange: null,
      currentCount: current.count,
      previousCount: previous.count,
      status: "insufficient",
    };
  }

  const percentChange =
    previous.average === 0
      ? null
      : roundOne(
          (difference /
            previous.average) *
            100
        );

  /*
   * Bei Sessions ist die Bewertung umgekehrt:
   *
   * Weniger Sessions = Verbesserung
   * Mehr Sessions = Verschlechterung
   */
  return {
    current: current.average,
    previous: previous.average,
    difference,
    percentChange,
    currentCount: current.count,
    previousCount: previous.count,

    status:
      difference < 0
        ? "increase"
        : difference > 0
        ? "decrease"
        : "unchanged",
  };
}

export function createGradeFlashRateTrends(
  currentItems: DatedBoulderItem[],
  previousItems: DatedBoulderItem[],
  grades: BoulderGrade[]
): GradeFlashRateTrend[] {
  return grades.map((grade) => {
    const currentGradeItems =
      currentItems.filter(
        ({ item }) =>
          item.boulderGrade === grade
      );

    const previousGradeItems =
      previousItems.filter(
        ({ item }) =>
          item.boulderGrade === grade
      );

    return {
      grade,

      trend: createFlashRateTrend(
        currentGradeItems,
        previousGradeItems,
        5
      ),
    };
  });
}

export function createStyleGradeFlashRateTrends(
  currentItems: DatedBoulderItem[],
  previousItems: DatedBoulderItem[],
  styles: BoulderStyle[],
  grades: BoulderGrade[]
): StyleGradeFlashRateTrend[] {
  const result:
    StyleGradeFlashRateTrend[] = [];

  styles.forEach((style) => {
    grades.forEach((grade) => {
      const currentGroup =
        currentItems.filter(
          ({ item }) =>
            item.boulderStyle === style &&
            item.boulderGrade === grade
        );

      const previousGroup =
        previousItems.filter(
          ({ item }) =>
            item.boulderStyle === style &&
            item.boulderGrade === grade
        );

      if (
        currentGroup.length === 0 &&
        previousGroup.length === 0
      ) {
        return;
      }

      result.push({
        style,
        grade,

        trend: createFlashRateTrend(
          currentGroup,
          previousGroup,
          5
        ),
      });
    });
  });

  return result;
}

export function createGradeSessionsTrends(
  currentItems: DatedBoulderItem[],
  previousItems: DatedBoulderItem[],
  grades: BoulderGrade[]
): GradeSessionsTrend[] {
  return grades.map((grade) => {
    const currentGradeItems =
      currentItems.filter(
        ({ item }) =>
          item.boulderGrade === grade
      );

    const previousGradeItems =
      previousItems.filter(
        ({ item }) =>
          item.boulderGrade === grade
      );

    return {
      grade,

      trend: createSessionsTrend(
        currentGradeItems,
        previousGradeItems,
        2
      ),
    };
  });
}

export function createStyleGradeSessionsTrends(
  currentItems: DatedBoulderItem[],
  previousItems: DatedBoulderItem[],
  styles: BoulderStyle[],
  grades: BoulderGrade[]
): StyleGradeSessionsTrend[] {
  const result:
    StyleGradeSessionsTrend[] = [];

  styles.forEach((style) => {
    grades.forEach((grade) => {
      const currentGroup =
        currentItems.filter(
          ({ item }) =>
            item.boulderStyle === style &&
            item.boulderGrade === grade
        );

      const previousGroup =
        previousItems.filter(
          ({ item }) =>
            item.boulderStyle === style &&
            item.boulderGrade === grade
        );

      if (
        currentGroup.length === 0 &&
        previousGroup.length === 0
      ) {
        return;
      }

      result.push({
        style,
        grade,

        trend: createSessionsTrend(
          currentGroup,
          previousGroup,
          2
        ),
      });
    });
  });

  return result;
}
