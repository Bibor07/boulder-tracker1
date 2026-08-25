import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { db } from "../../db/db";
import type {
  BodyMeasurement,
  BodyPart,
  BoulderGrade,
  BoulderStyle,
  DiaryEntry,
  DiaryExercise,
  Exercise,
} from "../../db/types";
import { exportBackupJson, importBackupJson } from "../../utils/backup";

import {
  aggregateAverage,
  aggregateLast,
  aggregateSum,
  getAggregationRange,
  type AggregationMode,
} from "./statisticsUtils";

import {
  createAverageGradeTrend,
  createCountTrend,
  createFlashRateTrend,
  createGradeCountTrends,
  createGradeFlashRateTrends,
  createGradeSessionsTrends,
  createStyleAverageGradeTrends,
  createStyleGradeCountTrends,
  createStyleGradeFlashRateTrends,
  createStyleGradeSessionsTrends,
  filterCurrentTrendPeriod,
  filterPreviousTrendPeriod,
  getTrendPeriod,
  type FlashRateTrendValue,
  type SessionsTrendValue,
  type TrendRangeDays,
  type TrendValue,
} from "./boulderTrendUtils";

type PeriodMode = "all" | "year" | "month";
type StatisticsTab = "training" | "bouldern" | "body";
type BoulderStatisticsTab =
  | "overview"
  | "timeline"
  | "styles"
  | "trends";

type ChartItem = {
  label: string;
  value: number;
};

type MultiLineChartPoint = {
  label: string;
  values: Record<string, number>;
};

type TrainingExerciseStat = {
  exerciseId: number;
  name: string;
  bodyPart: BodyPart;
  entries: number;
  sets: number;
  reps: number;
  timeSeconds: number;
  volume: number;
  lastDate: string;
};

type TrainingSetTrendPoint = {
  label: string;
  date: string;
  setNumber: number;
  cumulativeSet: number;
  weight: number;
  reps: number;
  timeSeconds: number;
};

const boulderStyles: BoulderStyle[] = [
  "Slab",
  "Dyno",
  "Platte",
  "Dynamisch",
  "Leiste",
  "Parkur Style",
  "Traverse",
];

const bodyParts: BodyPart[] = [
  "Finger",
  "Rücken",
  "Arme",
  "Core",
  "Brust",
  "Beine",
  "Ganzkörper",
  "Bouldern",
];

const gradeColors = [
  "#34d399",
  "#60a5fa",
  "#f97316",
  "#a78bfa",
  "#f472b6",
  "#facc15",
  "#22d3ee",
  "#fb7185",
  "#c084fc",
];

const monthOptions = [
  { value: 1, label: "Januar" },
  { value: 2, label: "Februar" },
  { value: 3, label: "März" },
  { value: 4, label: "April" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Dezember" },
];

function todayYear() {
  return new Date().getFullYear();
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function getYearFromDate(date: string) {
  return Number(date.slice(0, 4));
}

function getMonthFromDate(date: string) {
  return Number(date.slice(5, 7));
}

function formatSecondsToMinutes(seconds: number) {
  if (!seconds) return "0 min";
  return `${roundOne(seconds / 60)} min`;
}

function isDateInSelectedPeriod(
  date: string,
  periodMode: PeriodMode,
  selectedYear: number,
  selectedMonth: number
) {
  if (periodMode === "all") return true;

  const year = getYearFromDate(date);

  if (year !== selectedYear) return false;

  if (periodMode === "year") return true;

  return getMonthFromDate(date) === selectedMonth;
}

function periodLabel(
  periodMode: PeriodMode,
  selectedYear: number,
  selectedMonth: number
) {
  if (periodMode === "all") return "Gesamt";

  if (periodMode === "year") return `${selectedYear}`;

  const monthLabel =
    monthOptions.find((month) => month.value === selectedMonth)?.label ??
    selectedMonth.toString();

  return `${monthLabel} ${selectedYear}`;
}

function csvValue(value: unknown) {
  if (value === undefined || value === null) return "";

  const text = String(value).replace(/\r?\n|\r/g, " ");
  const escaped = text.replace(/"/g, '""');

  return `"${escaped}"`;
}

function downloadCsv(filename: string, rows: Array<Array<unknown>>) {
  const csvContent = [
    "sep=;",
    ...rows.map((row) => row.map(csvValue).join(";")),
  ].join("\n");

  const blob = new Blob(["\ufeff", csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
}

export default function StatisticsPage() {
  const [tab, setTab] = useState<StatisticsTab>("bouldern");
  const [
    boulderStatisticsTab,
    setBoulderStatisticsTab,
  ] = useState<BoulderStatisticsTab>(
    "overview"
  );
  const [
    selectedBoulderGrades,
    setSelectedBoulderGrades,
  ] = useState<BoulderGrade[]>([
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
  ]);
  const [
    selectedTimelineStyle,
    setSelectedTimelineStyle,
  ] = useState<BoulderStyle | "all">("all");
  const [dataMenuOpen, setDataMenuOpen] = useState(false);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("year");
  const [selectedYear, setSelectedYear] = useState(todayYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const [
    aggregationMode,
    setAggregationMode,
  ] = useState<AggregationMode>("month");

  const [
    trendRangeDays,
    setTrendRangeDays,
  ] = useState<TrendRangeDays>(30);

  const [selectedTrainingBodyPart, setSelectedTrainingBodyPart] =
    useState<BodyPart | "">("");
  const [selectedTrainingExerciseId, setSelectedTrainingExerciseId] = useState<
    number | ""
  >("");

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [diaryExercises, setDiaryExercises] = useState<DiaryExercise[]>([]);
  const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurement[]>(
    []
  );

  async function loadData() {
    const exerciseData = await db.exercises.toArray();
    const entryData = await db.diaryEntries.toArray();
    const diaryExerciseData = await db.diaryExercises.toArray();
    const bodyData = await db.bodyMeasurements.toArray();

    setExercises(exerciseData);
    setDiaryEntries(entryData);
    setDiaryExercises(diaryExerciseData);
    setBodyMeasurements(bodyData);
  }

  useEffect(() => {
    loadData();
  }, []);

  const exerciseMap = useMemo(() => {
    return new Map(
      exercises
        .filter((exercise) => exercise.id !== undefined)
        .map((exercise) => [exercise.id!, exercise])
    );
  }, [exercises]);

  const entryMap = useMemo(() => {
    return new Map(
      diaryEntries
        .filter((entry) => entry.id !== undefined)
        .map((entry) => [entry.id!, entry])
    );
  }, [diaryEntries]);

  const allDatedBoulderItems = useMemo(() => {
    return diaryExercises
      .filter((item) => {
        const exercise = exerciseMap.get(
          item.exerciseId
        );

        return exercise?.type === "boulder";
      })
      .map((item) => {
        const entry = entryMap.get(
          item.diaryEntryId
        );

        return {
          item,

          date:
            entry?.date ??
            item.createdAt.slice(0, 10),
        };
      });
  }, [
    diaryExercises,
    exerciseMap,
    entryMap,
  ]);

  async function handleBackupExport() {
    try {
      await exportBackupJson();
      alert("Backup wurde erstellt.");
    } catch (error) {
      console.error(error);
      alert("Backup konnte nicht erstellt werden.");
    }
  }

  async function handleBackupImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    const confirmed = window.confirm(
      "Beim Import werden alle aktuellen lokalen Daten überschrieben. Fortfahren?"
    );

    if (!confirmed) {
      event.target.value = "";
      return;
    }

    try {
      await importBackupJson(file);
      alert("Backup wurde importiert. Die App wird jetzt neu geladen.");
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Backup konnte nicht importiert werden.");
    } finally {
      event.target.value = "";
    }
  }

  function exportAllDataToCsv() {
    const rows: Array<Array<unknown>> = [
      [
        "Bereich",
        "Datum",
        "Session",
        "Übung",
        "Körperteil",
        "Übungstyp",
        "Satz",
        "Gewicht kg",
        "Wiederholungen",
        "Zeit sek",
        "Boulder Style",
        "Boulder Grad",
        "Boulder Sessions",
        "Körpergewicht kg",
        "KFA Final %",
        "BMI",
        "Notiz",
      ],
    ];

    diaryExercises.forEach((item) => {
      const exercise = exerciseMap.get(item.exerciseId);
      const entry = entryMap.get(item.diaryEntryId);

      if (!exercise) return;

      const date = entry?.date ?? item.createdAt.slice(0, 10);
      const sessionTitle = entry?.title ?? "Session";

      if (exercise.type === "boulder") {
        rows.push([
          "Bouldern",
          date,
          sessionTitle,
          exercise.name,
          exercise.bodyPart,
          exercise.type,
          "",
          "",
          "",
          "",
          item.boulderStyle ?? "",
          item.boulderGrade ?? "",
          item.boulderSessions ?? "",
          "",
          "",
          "",
          item.notes ?? "",
        ]);

        return;
      }

      if (item.setRows && item.setRows.length > 0) {
        item.setRows.forEach((setRow, index) => {
          rows.push([
            "Training",
            date,
            sessionTitle,
            exercise.name,
            exercise.bodyPart,
            exercise.type,
            index + 1,
            setRow.weightKg ?? "",
            exercise.type === "reps" ? setRow.reps ?? "" : "",
            exercise.type === "time" ? setRow.timeSeconds ?? "" : "",
            "",
            "",
            "",
            "",
            "",
            "",
            item.notes ?? "",
          ]);
        });

        return;
      }

      const setCount = Math.max(1, Number(item.sets ?? 1));

      for (let index = 0; index < setCount; index += 1) {
        rows.push([
          "Training",
          date,
          sessionTitle,
          exercise.name,
          exercise.bodyPart,
          exercise.type,
          index + 1,
          item.weightKg ?? "",
          exercise.type === "reps" ? item.reps ?? "" : "",
          exercise.type === "time" ? item.timeSeconds ?? "" : "",
          "",
          "",
          "",
          "",
          "",
          "",
          item.notes ?? "",
        ]);
      }
    });

    bodyMeasurements.forEach((item) => {
      rows.push([
        "Körper",
        item.date,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        item.weightKg,
        item.bodyFatPercent,
        item.bmi,
        item.notes ?? "",
      ]);
    });

    const today = new Date().toISOString().slice(0, 10);

    downloadCsv(`VerticalProgress_Export_${today}.csv`, rows);
  }

  const availableYears = useMemo(() => {
    const years = new Set<number>();

    diaryEntries.forEach((entry) => years.add(getYearFromDate(entry.date)));
    bodyMeasurements.forEach((item) => years.add(getYearFromDate(item.date)));

    years.add(todayYear());

    return Array.from(years).sort((a, b) => b - a);
  }, [diaryEntries, bodyMeasurements]);

  const filteredEntries = useMemo(() => {
    return diaryEntries.filter((entry) =>
      isDateInSelectedPeriod(
        entry.date,
        periodMode,
        selectedYear,
        selectedMonth
      )
    );
  }, [diaryEntries, periodMode, selectedYear, selectedMonth]);

  const filteredEntryIds = useMemo(() => {
    return new Set(
      filteredEntries
        .filter((entry) => entry.id !== undefined)
        .map((entry) => entry.id!)
    );
  }, [filteredEntries]);

  const filteredDiaryExercises = useMemo(() => {
    return diaryExercises.filter((item) =>
      filteredEntryIds.has(item.diaryEntryId)
    );
  }, [diaryExercises, filteredEntryIds]);

  const boulderItems = useMemo(() => {
    return filteredDiaryExercises.filter((item) => {
      const exercise = exerciseMap.get(item.exerciseId);
      return exercise?.type === "boulder";
    });
  }, [filteredDiaryExercises, exerciseMap]);

  const strengthItems = useMemo(() => {
    return filteredDiaryExercises.filter((item) => {
      const exercise = exerciseMap.get(item.exerciseId);
      return exercise?.type === "reps" || exercise?.type === "time";
    });
  }, [filteredDiaryExercises, exerciseMap]);

  const trainingSessionCount = useMemo(() => {
    return new Set(strengthItems.map((item) => item.diaryEntryId)).size;
  }, [strengthItems]);

  const boulderSessionCount = useMemo(() => {
    return new Set(boulderItems.map((item) => item.diaryEntryId)).size;
  }, [boulderItems]);

  const filteredBodyMeasurements = useMemo(() => {
    return bodyMeasurements
      .filter((item) =>
        isDateInSelectedPeriod(
          item.date,
          periodMode,
          selectedYear,
          selectedMonth
        )
      )
      .filter(
        (item) =>
          Number.isFinite(Number(item.weightKg)) &&
          Number.isFinite(Number(item.bodyFatPercent)) &&
          Number.isFinite(Number(item.bmi))
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [bodyMeasurements, periodMode, selectedYear, selectedMonth]);

  const latestBody = filteredBodyMeasurements.at(-1) ?? null;
  const previousBody =
    filteredBodyMeasurements.length >= 2
      ? filteredBodyMeasurements[filteredBodyMeasurements.length - 2]
      : null;

  const boulderGradesWithData = useMemo(() => {
    const grades = new Set<BoulderGrade>();

    boulderItems.forEach((item) => {
      if (item.boulderGrade) {
        grades.add(item.boulderGrade);
      }
    });

    return Array.from(grades).sort((a, b) => a - b);
  }, [boulderItems]);

  const visibleBoulderGrades = useMemo(() => {
    return boulderGradesWithData.filter(
      (grade) =>
        selectedBoulderGrades.includes(grade)
    );
  }, [
    boulderGradesWithData,
    selectedBoulderGrades,
  ]);

  function getBoulderCountByGrade(grade: BoulderGrade) {
    return boulderItems.filter((item) => item.boulderGrade === grade).length;
  }

  function getBoulderCountByStyleAndGrade(
    style: BoulderStyle,
    grade: BoulderGrade
  ) {
    return boulderItems.filter(
      (item) => item.boulderStyle === style && item.boulderGrade === grade
    ).length;
  }

  function getTrainingItemTotals(item: DiaryExercise) {
    const exercise = exerciseMap.get(item.exerciseId);

    let sets = 0;
    let reps = 0;
    let timeSeconds = 0;
    let volume = 0;
    let weightSum = 0;
    let weightCount = 0;

    if (item.setRows && item.setRows.length > 0) {
      sets = item.setRows.length;

      item.setRows.forEach((row) => {
        const rowReps = row.reps ?? 0;
        const rowWeight = row.weightKg ?? 0;
        const rowTime = row.timeSeconds ?? 0;

        reps += rowReps;
        timeSeconds += rowTime;
        weightSum += rowWeight;
        weightCount += 1;

        if (exercise?.type === "reps") {
          volume += rowWeight * rowReps;
        }
      });

      return {
        sets,
        reps,
        timeSeconds,
        volume,
        weightSum,
        weightCount,
      };
    }

    sets = item.sets ?? 0;
    reps = item.reps ? item.reps * sets : 0;
    timeSeconds = item.timeSeconds ? item.timeSeconds * sets : 0;

    if (item.weightKg !== undefined) {
      weightSum = item.weightKg;
      weightCount = 1;
    }

    if (exercise?.type === "reps") {
      volume = (item.weightKg ?? 0) * reps;
    }

    return {
      sets,
      reps,
      timeSeconds,
      volume,
      weightSum,
      weightCount,
    };
  }

  const trainingExerciseStats = useMemo(() => {
    const statMap = new Map<number, TrainingExerciseStat>();

    strengthItems.forEach((item) => {
      const exercise = exerciseMap.get(item.exerciseId);
      const entry = entryMap.get(item.diaryEntryId);

      if (!exercise || !exercise.id) return;

      const current = statMap.get(exercise.id) ?? {
        exerciseId: exercise.id,
        name: exercise.name,
        bodyPart: exercise.bodyPart,
        entries: 0,
        sets: 0,
        reps: 0,
        timeSeconds: 0,
        volume: 0,
        lastDate: "",
      };

      const totals = getTrainingItemTotals(item);
      const itemDate = entry?.date ?? item.createdAt.slice(0, 10);

      statMap.set(exercise.id, {
        ...current,
        entries: current.entries + 1,
        sets: current.sets + totals.sets,
        reps: current.reps + totals.reps,
        timeSeconds: current.timeSeconds + totals.timeSeconds,
        volume: current.volume + totals.volume,
        lastDate: itemDate > current.lastDate ? itemDate : current.lastDate,
      });
    });

    return Array.from(statMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [strengthItems, exerciseMap, entryMap]);

  const trainingSummary = useMemo(() => {
    return trainingExerciseStats.reduce(
      (summary, item) => ({
        entries: summary.entries + item.entries,
        sets: summary.sets + item.sets,
        reps: summary.reps + item.reps,
        timeSeconds: summary.timeSeconds + item.timeSeconds,
        volume: summary.volume + item.volume,
      }),
      {
        entries: 0,
        sets: 0,
        reps: 0,
        timeSeconds: 0,
        volume: 0,
      }
    );
  }, [trainingExerciseStats]);


  const trainingSessionsChartData = useMemo(() => {
    const strengthEntryIds = new Set(
      strengthItems.map(
        (item) => item.diaryEntryId
      )
    );

    const strengthEntries = filteredEntries.filter(
      (entry) =>
        entry.id !== undefined &&
        strengthEntryIds.has(entry.id)
    );

    return aggregateSum(
      strengthEntries,
      (entry) => entry.date,
      () => 1,
      aggregationMode
    ).map((item) => ({
      label: item.label,
      value: item.value,
    }));
  }, [
    strengthItems,
    filteredEntries,
    aggregationMode,
  ]);

  const availableTrainingExercisesForBodyPart = useMemo(() => {
    if (!selectedTrainingBodyPart) return [];

    const exerciseIdsWithData = new Set(
      strengthItems.map((item) => item.exerciseId)
    );

    return exercises
      .filter(
        (exercise) =>
          exercise.id !== undefined &&
          exerciseIdsWithData.has(exercise.id) &&
          exercise.bodyPart === selectedTrainingBodyPart &&
          exercise.type !== "boulder"
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, strengthItems, selectedTrainingBodyPart]);

  const selectedTrainingExercise = useMemo(() => {
    if (!selectedTrainingExerciseId) return null;

    return exerciseMap.get(selectedTrainingExerciseId) ?? null;
  }, [selectedTrainingExerciseId, exerciseMap]);

  const selectedTrainingItems = useMemo(() => {
    if (!selectedTrainingExerciseId) return [];

    return strengthItems
      .filter((item) => item.exerciseId === selectedTrainingExerciseId)
      .sort((a, b) => {
        const entryA = entryMap.get(a.diaryEntryId);
        const entryB = entryMap.get(b.diaryEntryId);

        const dateA = entryA?.date ?? a.createdAt.slice(0, 10);
        const dateB = entryB?.date ?? b.createdAt.slice(0, 10);

        return dateA.localeCompare(dateB);
      });
  }, [strengthItems, selectedTrainingExerciseId, entryMap]);

  const selectedTrainingTrend = useMemo<TrainingSetTrendPoint[]>(() => {
    const points: TrainingSetTrendPoint[] = [];
    let cumulativeSet = 0;

    selectedTrainingItems.forEach((item) => {
      const entry = entryMap.get(item.diaryEntryId);
      const date = entry?.date ?? item.createdAt.slice(0, 10);

      if (item.setRows && item.setRows.length > 0) {
        item.setRows.forEach((row, setIndex) => {
          cumulativeSet += 1;

          points.push({
            label: `${date} S${setIndex + 1}`,
            date,
            setNumber: setIndex + 1,
            cumulativeSet,
            weight: Number(row.weightKg ?? 0),
            reps: Number(row.reps ?? 0),
            timeSeconds: Number(row.timeSeconds ?? 0),
          });
        });

        return;
      }

      const setCount = Math.max(1, Number(item.sets ?? 1));

      for (let index = 0; index < setCount; index += 1) {
        cumulativeSet += 1;

        points.push({
          label: `${date} S${index + 1}`,
          date,
          setNumber: index + 1,
          cumulativeSet,
          weight: Number(item.weightKg ?? 0),
          reps: Number(item.reps ?? 0),
          timeSeconds: Number(item.timeSeconds ?? 0),
        });
      }
    });

    return points;
  }, [selectedTrainingItems, entryMap]);

  const selectedTrainingTotals = useMemo(() => {
    const sets = selectedTrainingTrend.length;

    const reps = selectedTrainingTrend.reduce(
      (sum, item) => sum + item.reps,
      0
    );

    const timeSeconds = selectedTrainingTrend.reduce(
      (sum, item) => sum + item.timeSeconds,
      0
    );

    const weightValues = selectedTrainingTrend
      .map((item) => item.weight)
      .filter((value) => Number.isFinite(value));

    const averageWeight =
      weightValues.length > 0
        ? roundOne(
            weightValues.reduce((sum, value) => sum + value, 0) /
              weightValues.length
          )
        : 0;

    const averageReps = sets > 0 ? roundOne(reps / sets) : 0;
    const averageTimeSeconds = sets > 0 ? roundOne(timeSeconds / sets) : 0;

    return {
      sets,
      reps,
      timeSeconds,
      averageWeight,
      averageReps,
      averageTimeSeconds,
    };
  }, [selectedTrainingTrend]);

  const selectedWeightChartData: ChartItem[] = selectedTrainingTrend.map(
    (item) => ({
      label: item.label,
      value: item.weight,
    })
  );

  const selectedRepsChartData: ChartItem[] = selectedTrainingTrend.map(
    (item) => ({
      label: item.label,
      value: item.reps,
    })
  );

  const selectedTimeChartData: ChartItem[] = selectedTrainingTrend.map(
    (item) => ({
      label: item.label,
      value: item.timeSeconds,
    })
  );

  const boulderGradeChartData = useMemo(() => {
    return boulderGradesWithData.map((grade) => ({
      label: `G${grade}`,
      value: getBoulderCountByGrade(grade),
    }));
  }, [boulderGradesWithData, boulderItems]);

  const boulderGradeTimelineData = useMemo<
    MultiLineChartPoint[]
  >(() => {
    const grouped = new Map<
      string,
      {
        label: string;
        startDate: string;
        values: Record<string, number>;
      }
    >();

    boulderItems.forEach((item) => {
      const grade = item.boulderGrade;

      if (
        grade === undefined ||
        !visibleBoulderGrades.includes(grade)
      ) {
        return;
      }

      if (
        selectedTimelineStyle !== "all" &&
        item.boulderStyle !== selectedTimelineStyle
      ) {
        return;
      }

      const entry = entryMap.get(
        item.diaryEntryId
      );

      const date =
        entry?.date ??
        item.createdAt.slice(0, 10);

      const range = getAggregationRange(
        date,
        aggregationMode
      );

      let current = grouped.get(range.key);

      if (!current) {
        const initialValues: Record<
          string,
          number
        > = {};

        visibleBoulderGrades.forEach(
          (visibleGrade) => {
            initialValues[
              `G${visibleGrade}`
            ] = 0;
          }
        );

        current = {
          label: range.label,
          startDate: range.startDate,
          values: initialValues,
        };

        grouped.set(range.key, current);
      }

      const seriesName = `G${grade}`;

      current.values[seriesName] =
        (current.values[seriesName] ?? 0) + 1;
    });

    return Array.from(grouped.values())
      .sort((a, b) =>
        a.startDate.localeCompare(
          b.startDate
        )
      )
      .map((item) => ({
        label: item.label,
        values: item.values,
      }));
  }, [
    boulderItems,
    entryMap,
    aggregationMode,
    visibleBoulderGrades,
    selectedTimelineStyle,
  ]);

  const sessionsByGradeTimelineData = useMemo<
    MultiLineChartPoint[]
  >(() => {
    const grouped = new Map<
      string,
      {
        label: string;
        startDate: string;
        values: Record<
          string,
          {
            sum: number;
            count: number;
          }
        >;
      }
    >();

    boulderItems.forEach((item) => {
      const grade = item.boulderGrade;

      if (
        grade === undefined ||
        !visibleBoulderGrades.includes(grade) ||
        item.boulderSessions === undefined
      ) {
        return;
      }

      if (
        selectedTimelineStyle !== "all" &&
        item.boulderStyle !==
          selectedTimelineStyle
      ) {
        return;
      }

      const sessions = Number(
        item.boulderSessions
      );

      if (
        !Number.isFinite(sessions) ||
        sessions < 1
      ) {
        return;
      }

      const entry = entryMap.get(
        item.diaryEntryId
      );

      const date =
        entry?.date ??
        item.createdAt.slice(0, 10);

      const range = getAggregationRange(
        date,
        aggregationMode
      );

      let period = grouped.get(range.key);

      if (!period) {
        period = {
          label: range.label,
          startDate: range.startDate,
          values: {},
        };

        grouped.set(range.key, period);
      }

      const seriesName = `G${grade}`;

      const current = period.values[
        seriesName
      ] ?? {
        sum: 0,
        count: 0,
      };

      period.values[seriesName] = {
        sum: current.sum + sessions,
        count: current.count + 1,
      };
    });

    return Array.from(grouped.values())
      .sort((a, b) =>
        a.startDate.localeCompare(
          b.startDate
        )
      )
      .map((period) => {
        const values: Record<
          string,
          number
        > = {};

        visibleBoulderGrades.forEach(
          (grade) => {
            const seriesName = `G${grade}`;

            const data =
              period.values[seriesName];

            if (data && data.count > 0) {
              values[seriesName] = roundOne(
                data.sum / data.count
              );
            }
          }
        );

        return {
          label: period.label,
          values,
        };
      });
  }, [
    boulderItems,
    entryMap,
    aggregationMode,
    visibleBoulderGrades,
    selectedTimelineStyle,
  ]);

  const flashRateByGradeTimelineData = useMemo<
    MultiLineChartPoint[]
  >(() => {
    const grouped = new Map<
      string,
      {
        label: string;
        startDate: string;
        values: Record<
          string,
          {
            flashes: number;
            count: number;
          }
        >;
      }
    >();

    boulderItems.forEach((item) => {
      const grade = item.boulderGrade;

      if (
        grade === undefined ||
        !visibleBoulderGrades.includes(grade) ||
        item.isFlash === undefined
      ) {
        return;
      }

      if (
        selectedTimelineStyle !== "all" &&
        item.boulderStyle !==
          selectedTimelineStyle
      ) {
        return;
      }

      const entry = entryMap.get(
        item.diaryEntryId
      );

      const date =
        entry?.date ??
        item.createdAt.slice(0, 10);

      const range = getAggregationRange(
        date,
        aggregationMode
      );

      let period = grouped.get(range.key);

      if (!period) {
        period = {
          label: range.label,
          startDate: range.startDate,
          values: {},
        };

        grouped.set(range.key, period);
      }

      const seriesName = `G${grade}`;

      const current = period.values[
        seriesName
      ] ?? {
        flashes: 0,
        count: 0,
      };

      period.values[seriesName] = {
        flashes:
          current.flashes +
          (item.isFlash ? 1 : 0),

        count: current.count + 1,
      };
    });

    return Array.from(grouped.values())
      .sort((a, b) =>
        a.startDate.localeCompare(
          b.startDate
        )
      )
      .map((period) => {
        const values: Record<
          string,
          number
        > = {};

        visibleBoulderGrades.forEach(
          (grade) => {
            const seriesName = `G${grade}`;

            const data =
              period.values[seriesName];

            if (data && data.count > 0) {
              values[seriesName] = roundOne(
                (data.flashes /
                  data.count) *
                  100
              );
            }
          }
        );

        return {
          label: period.label,
          values,
        };
      });
  }, [
    boulderItems,
    entryMap,
    aggregationMode,
    visibleBoulderGrades,
    selectedTimelineStyle,
  ]);

  const averageGradeByStyle = useMemo(() => {
    return boulderStyles
      .map((style) => {
        const grades = boulderItems
          .filter(
            (item) =>
              item.boulderStyle === style &&
              item.boulderGrade !== undefined
          )
          .map(
            (item) =>
              item.boulderGrade as BoulderGrade
          );

        if (grades.length === 0) {
          return null;
        }

        const average = roundOne(
          grades.reduce(
            (sum, grade) => sum + grade,
            0
          ) / grades.length
        );

        return {
          style,
          average,
          count: grades.length,
        };
      })
      .filter(
        (
          item
        ): item is {
          style: BoulderStyle;
          average: number;
          count: number;
        } => item !== null
      )
      .sort(
        (a, b) => b.average - a.average
      );
  }, [boulderItems]);

  const sessionsByGrade = useMemo(() => {
    return boulderGradesWithData
      .map((grade) => {
        const items = boulderItems.filter(
          (item) =>
            item.boulderGrade === grade &&
            item.boulderSessions !==
              undefined &&
            Number.isFinite(
              Number(item.boulderSessions)
            )
        );

        if (items.length === 0) {
          return null;
        }

        const averageSessions = roundOne(
          items.reduce(
            (sum, item) =>
              sum +
              Number(
                item.boulderSessions ?? 0
              ),
            0
          ) / items.length
        );

        return {
          grade,
          averageSessions,
          count: items.length,
        };
      })
      .filter(
        (
          item
        ): item is {
          grade: BoulderGrade;
          averageSessions: number;
          count: number;
        } => item !== null
      );
  }, [
    boulderItems,
    boulderGradesWithData,
  ]);

  function getAverageSessionsByStyleAndGrade(
    style: BoulderStyle,
    grade: BoulderGrade
  ) {
    const items = boulderItems.filter(
      (item) =>
        item.boulderStyle === style &&
        item.boulderGrade === grade &&
        item.boulderSessions !== undefined &&
        Number.isFinite(
          Number(item.boulderSessions)
        )
    );

    if (items.length === 0) {
      return null;
    }

    return roundOne(
      items.reduce(
        (sum, item) =>
          sum +
          Number(item.boulderSessions ?? 0),
        0
      ) / items.length
    );
  }

  const flashRateByGrade = useMemo(() => {
    return boulderGradesWithData
      .map((grade) => {
        const items = boulderItems.filter(
          (item) =>
            item.boulderGrade === grade &&
            item.isFlash !== undefined
        );

        if (items.length === 0) {
          return null;
        }

        const flashes = items.filter(
          (item) => item.isFlash === true
        ).length;

        return {
          grade,
          flashRate: roundOne(
            (flashes / items.length) * 100
          ),
          flashes,
          count: items.length,
        };
      })
      .filter(
        (
          item
        ): item is {
          grade: BoulderGrade;
          flashRate: number;
          flashes: number;
          count: number;
        } => item !== null
      );
  }, [boulderItems, boulderGradesWithData]);

  function getFlashRateByStyleAndGrade(
    style: BoulderStyle,
    grade: BoulderGrade
  ) {
    const items = boulderItems.filter(
      (item) =>
        item.boulderStyle === style &&
        item.boulderGrade === grade &&
        item.isFlash !== undefined
    );

    if (items.length === 0) {
      return null;
    }

    const flashes = items.filter(
      (item) => item.isFlash === true
    ).length;

    return {
      rate: roundOne(
        (flashes / items.length) * 100
      ),
      flashes,
      count: items.length,
    };
  }

  const bodyWeightChartData = useMemo(() => {
    return aggregateLast(
      filteredBodyMeasurements,
      (item) => item.date,
      (item) => Number(item.weightKg),
      aggregationMode
    ).map((item) => ({
      label: item.label,
      value: item.value,
    }));
  }, [
    filteredBodyMeasurements,
    aggregationMode,
  ]);

  const bodyFatChartData = useMemo(() => {
    return aggregateLast(
      filteredBodyMeasurements,
      (item) => item.date,
      (item) =>
        Number(item.bodyFatPercent),
      aggregationMode
    ).map((item) => ({
      label: item.label,
      value: item.value,
    }));
  }, [
    filteredBodyMeasurements,
    aggregationMode,
  ]);

  const heaviestBoulderGrade = useMemo(() => {
    if (boulderGradesWithData.length === 0) return null;

    return Math.max(...boulderGradesWithData);
  }, [boulderGradesWithData]);

  const averageBoulderGrade = useMemo(() => {
    const grades = boulderItems
      .map((item) => item.boulderGrade)
      .filter((grade): grade is BoulderGrade => Boolean(grade));

    if (grades.length === 0) return null;

    const total = grades.reduce((sum, grade) => sum + grade, 0);

    return roundOne(total / grades.length);
  }, [boulderItems]);

  const boulderEntryDates = useMemo(() => {
    return boulderItems.map((item) => {
      const entry = entryMap.get(
        item.diaryEntryId
      );

      return {
        item,
        date:
          entry?.date ??
          item.createdAt.slice(0, 10),
      };
    });
  }, [boulderItems, entryMap]);

  const bouldersLast30Days = useMemo(() => {
    const today = new Date();

    const startDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 29
    );

    const startIso = startDate
      .toISOString()
      .slice(0, 10);

    const endIso = today
      .toISOString()
      .slice(0, 10);

    return boulderEntryDates.filter(
      ({ date }) =>
        date >= startIso &&
        date <= endIso
    ).length;
  }, [boulderEntryDates]);

  const averageGradeLast30Days =
    useMemo(() => {
      const today = new Date();

      const startDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - 29
      );

      const startIso = startDate
        .toISOString()
        .slice(0, 10);

      const endIso = today
        .toISOString()
        .slice(0, 10);

      const grades = boulderEntryDates
        .filter(
          ({ date }) =>
            date >= startIso &&
            date <= endIso
        )
        .map(({ item }) =>
          item.boulderGrade
        )
        .filter(
          (
            grade
          ): grade is BoulderGrade =>
            grade !== undefined
        );

      if (grades.length === 0) {
        return null;
      }

      return roundOne(
        grades.reduce(
          (sum, grade) => sum + grade,
          0
        ) / grades.length
      );
    }, [boulderEntryDates]);

  const hardestFlashGrade = useMemo(() => {
    const flashGrades = boulderItems
      .filter((item) => item.isFlash)
      .map((item) => item.boulderGrade)
      .filter(
        (
          grade
        ): grade is BoulderGrade =>
          grade !== undefined
      );

    if (flashGrades.length === 0) {
      return null;
    }

    return Math.max(...flashGrades);
  }, [boulderItems]);

  const flashRate = useMemo(() => {
    const itemsWithFlashInformation =
      boulderItems.filter(
        (item) => item.isFlash !== undefined
      );

    if (
      itemsWithFlashInformation.length === 0
    ) {
      return null;
    }

    const flashCount =
      itemsWithFlashInformation.filter(
        (item) => item.isFlash === true
      ).length;

    return roundOne(
      (flashCount /
        itemsWithFlashInformation.length) *
        100
    );
  }, [boulderItems]);

    const bouldersPerSession = useMemo(() => {
      if (boulderSessionCount === 0) {
        return null;
      }

      return roundOne(
        boulderItems.length /
          boulderSessionCount
      );
    }, [
      boulderItems,
      boulderSessionCount,
    ]);

    const aggregatedBoulderCount = useMemo(() => {
      return aggregateSum(
        boulderEntryDates,
        (entry) => entry.date,
        () => 1,
        aggregationMode
      ).map((item) => ({
        label: item.label,
        value: item.value,
      }));
    }, [
      boulderEntryDates,
      aggregationMode,
    ]);

    const aggregatedAverageGrade = useMemo(() => {
      return aggregateAverage(
        boulderEntryDates,
        (entry) => entry.date,
        (entry) =>
          entry.item.boulderGrade,
        aggregationMode
      ).map((item) => ({
        label: item.label,
        value: roundOne(item.value),
      }));
    }, [
      boulderEntryDates,
      aggregationMode,
    ]);                                     

  const aggregatedBoulderSessions =
    useMemo(() => {
      const boulderEntryIds = new Set(
        boulderItems.map(
          (item) => item.diaryEntryId
        )
      );

      const sessions = filteredEntries.filter(
        (entry) =>
          entry.id !== undefined &&
          boulderEntryIds.has(entry.id)
      );

      return aggregateSum(
        sessions,
        (entry) => entry.date,
        () => 1,
        aggregationMode
      ).map((item) => ({
        label: item.label,
        value: item.value,
      }));
    }, [
      boulderItems,
      filteredEntries,
      aggregationMode,
    ]);

  const trendPeriod = useMemo(() => {
    return getTrendPeriod(
      trendRangeDays
    );
  }, [trendRangeDays]);

  const currentTrendBoulders = useMemo(() => {
    return filterCurrentTrendPeriod(
      allDatedBoulderItems,
      trendPeriod
    );
  }, [
    allDatedBoulderItems,
    trendPeriod,
  ]);

  const previousTrendBoulders = useMemo(() => {
    return filterPreviousTrendPeriod(
      allDatedBoulderItems,
      trendPeriod
    );
  }, [
    allDatedBoulderItems,
    trendPeriod,
  ]);

  const totalBoulderTrend = useMemo(() => {
    return createCountTrend(
      currentTrendBoulders.length,
      previousTrendBoulders.length
    );
  }, [
    currentTrendBoulders,
    previousTrendBoulders,
  ]);

  const boulderSessionTrend = useMemo(() => {
    const currentSessionCount =
      new Set(
        currentTrendBoulders.map(
          ({ item }) =>
            item.diaryEntryId
        )
      ).size;

    const previousSessionCount =
      new Set(
        previousTrendBoulders.map(
          ({ item }) =>
            item.diaryEntryId
        )
      ).size;

    return createCountTrend(
      currentSessionCount,
      previousSessionCount
    );
  }, [
    currentTrendBoulders,
    previousTrendBoulders,
  ]);

  const averageGradeTrend = useMemo(() => {
    return createAverageGradeTrend(
      currentTrendBoulders,
      previousTrendBoulders,
      3
    );
  }, [
    currentTrendBoulders,
    previousTrendBoulders,
  ]);

  const trendFlashRate = useMemo(() => {
    return createFlashRateTrend(
      currentTrendBoulders,
      previousTrendBoulders,
      5
    );
  }, [
    currentTrendBoulders,
    previousTrendBoulders,
  ]);

  const gradeCountTrends = useMemo(() => {
    return createGradeCountTrends(
      currentTrendBoulders,
      previousTrendBoulders,
      visibleBoulderGrades
    );
  }, [
    currentTrendBoulders,
    previousTrendBoulders,
    visibleBoulderGrades,
  ]);

  const styleGradeCountTrends = useMemo(() => {
    return createStyleGradeCountTrends(
      currentTrendBoulders,
      previousTrendBoulders,
      boulderStyles,
      visibleBoulderGrades
    );
  }, [
    currentTrendBoulders,
    previousTrendBoulders,
    visibleBoulderGrades,
  ]);

  const styleAverageGradeTrends =
    useMemo(() => {
      return createStyleAverageGradeTrends(
        currentTrendBoulders,
        previousTrendBoulders,
        boulderStyles
      );
    }, [
      currentTrendBoulders,
      previousTrendBoulders,
    ]);

  const gradeFlashRateTrends = useMemo(() => {
    return createGradeFlashRateTrends(
      currentTrendBoulders,
      previousTrendBoulders,
      visibleBoulderGrades
    );
  }, [
    currentTrendBoulders,
    previousTrendBoulders,
    visibleBoulderGrades,
  ]);

  const styleGradeFlashRateTrends =
    useMemo(() => {
      return createStyleGradeFlashRateTrends(
        currentTrendBoulders,
        previousTrendBoulders,
        boulderStyles,
        visibleBoulderGrades
      );
    }, [
      currentTrendBoulders,
      previousTrendBoulders,
      visibleBoulderGrades,
    ]);

  const gradeSessionsTrends = useMemo(() => {
    return createGradeSessionsTrends(
      currentTrendBoulders,
      previousTrendBoulders,
      visibleBoulderGrades
    );
  }, [
    currentTrendBoulders,
    previousTrendBoulders,
    visibleBoulderGrades,
  ]);

  const styleGradeSessionsTrends =
    useMemo(() => {
      return createStyleGradeSessionsTrends(
        currentTrendBoulders,
        previousTrendBoulders,
        boulderStyles,
        visibleBoulderGrades
      );
    }, [
      currentTrendBoulders,
      previousTrendBoulders,
      visibleBoulderGrades,
    ]);

  function toggleBoulderGrade(
    grade: BoulderGrade
  ) {
    setSelectedBoulderGrades((current) => {
      if (current.includes(grade)) {
        return current.filter(
          (item) => item !== grade
        );
      }

      return [...current, grade].sort(
        (a, b) => a - b
      );
    });
  }

  return (
    <section className="card">

      <div className="page-header">
        <div>
          <h2>Statistik</h2>
          <p>Training, Bouldern und Körperdaten auswerten.</p>
        </div>

        <div className="plan-menu-wrapper data-menu-wrapper">
          <button
            className="primary-action-button"
            onClick={() => setDataMenuOpen((current) => !current)}
          >
            Daten
          </button>

          {dataMenuOpen && (
            <div className="plan-options-menu data-options-menu">
              <button
                className="menu-button"
                onClick={() => {
                  setDataMenuOpen(false);
                  handleBackupExport();
                }}
              >
                Backup exportieren
              </button>

              <label className="menu-button file-menu-button">
                Backup importieren
                <input
                  type="file"
                  accept="application/json"
                  onChange={(event) => {
                    setDataMenuOpen(false);
                    handleBackupImport(event);
                  }}
                  hidden
                />
              </label>

              <button
                className="menu-button"
                onClick={() => {
                  setDataMenuOpen(false);
                  exportAllDataToCsv();
                }}
              >
                CSV exportieren
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="sub-card">
        <h3>Zeitraum</h3>

        <div className="form-block compact">
          <label className="field-label">
            Datenbereich
          </label>

          <select
            value={periodMode}
            onChange={(event) =>
              setPeriodMode(
                event.target.value as PeriodMode
              )
            }
          >
            <option value="all">Gesamt</option>
            <option value="year">Jahr</option>
            <option value="month">Monat</option>
          </select>

          {periodMode !== "all" && (
            <>
              <label className="field-label">
                Jahr
              </label>

              <select
                value={selectedYear}
                onChange={(event) =>
                  setSelectedYear(
                    Number(event.target.value)
                  )
                }
              >
                {availableYears.map((year) => (
                  <option
                    key={year}
                    value={year}
                  >
                    {year}
                  </option>
                ))}
              </select>
            </>
          )}

          {periodMode === "month" && (
            <>
              <label className="field-label">
                Monat
              </label>

              <select
                value={selectedMonth}
                onChange={(event) =>
                  setSelectedMonth(
                    Number(event.target.value)
                  )
                }
              >
                {monthOptions.map((month) => (
                  <option
                    key={month.value}
                    value={month.value}
                  >
                    {month.label}
                  </option>
                ))}
              </select>
            </>
          )}

          <label className="field-label">
            Zeitliche Aggregation
          </label>

          <select
            value={aggregationMode}
            onChange={(event) =>
              setAggregationMode(
                event.target.value as AggregationMode
              )
            }
          >
            <option value="week">Woche</option>
            <option value="month">Monat</option>
            <option value="quarter">
              Quartal
            </option>
            <option value="year">Jahr</option>
          </select>
        </div>
      </div>

      <div className="stats-tab-bar">
        <button
          className={tab === "training" ? "active-tab" : ""}
          onClick={() => setTab("training")}
        >
          Training
        </button>

        <button
          className={tab === "bouldern" ? "active-tab" : ""}
          onClick={() => setTab("bouldern")}
        >
          Bouldern
        </button>

        <button
          className={tab === "body" ? "active-tab" : ""}
          onClick={() => setTab("body")}
        >
          Körper
        </button>
      </div>

      {tab === "training" && (
        <>
          <div className="sub-card">
            <h3>
              Training · {periodLabel(periodMode, selectedYear, selectedMonth)}
            </h3>

            <div className="stats-grid">
              <StatBox
                label="Training-Sessions"
                value={trainingSessionCount.toString()}
              />
              <StatBox
                label="Trainingseinträge"
                value={trainingSummary.entries.toString()}
              />
              <StatBox
                label="Gesamt-Sätze"
                value={trainingSummary.sets.toString()}
              />
              <StatBox
                label="Gesamt-Wdh."
                value={trainingSummary.reps.toString()}
              />
              <StatBox
                label="Gesamt-Zeit"
                value={formatSecondsToMinutes(trainingSummary.timeSeconds)}
              />
              <StatBox
                label="Volumen"
                value={`${roundOne(trainingSummary.volume)} kg×Wdh.`}
              />
            </div>
          </div>

          <div className="sub-card">
            <h3>Training-Sessions im Verlauf</h3>

            {trainingSessionsChartData.every((item) => item.value === 0) ? (
              <p>Noch keine Training-Sessions im ausgewählten Zeitraum.</p>
            ) : (
              <SimpleBarChart
                data={trainingSessionsChartData.filter(
                  (item) => item.value > 0
                )}
              />
            )}
          </div>

          <div className="sub-card">
            <h3>Übung auswerten</h3>

            <div className="form-block compact">
              <select
                value={selectedTrainingBodyPart}
                onChange={(event) => {
                  setSelectedTrainingBodyPart(event.target.value as BodyPart);
                  setSelectedTrainingExerciseId("");
                }}
              >
                <option value="">Körperteil auswählen</option>
                {bodyParts
                  .filter((bodyPart) => bodyPart !== "Bouldern")
                  .map((bodyPart) => (
                    <option key={bodyPart} value={bodyPart}>
                      {bodyPart}
                    </option>
                  ))}
              </select>

              <select
                value={selectedTrainingExerciseId}
                disabled={!selectedTrainingBodyPart}
                onChange={(event) =>
                  setSelectedTrainingExerciseId(
                    event.target.value ? Number(event.target.value) : ""
                  )
                }
              >
                <option value="">Übung auswählen</option>
                {availableTrainingExercisesForBodyPart.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </option>
                ))}
              </select>
            </div>

            {!selectedTrainingExercise && (
              <p className="hint">
                Wähle zuerst ein Körperteil und danach eine Übung aus.
              </p>
            )}

            {selectedTrainingExercise && selectedTrainingTrend.length === 0 && (
              <p>Keine Daten für diese Übung im ausgewählten Zeitraum.</p>
            )}

            {selectedTrainingExercise && selectedTrainingTrend.length > 0 && (
              <>
                <div className="stats-grid">
                  <StatBox
                    label="Sätze"
                    value={selectedTrainingTotals.sets.toString()}
                  />

                  <StatBox
                    label="Ø Gewicht"
                    value={`${selectedTrainingTotals.averageWeight} kg`}
                  />

                  {selectedTrainingExercise.type === "reps" && (
                    <>
                      <StatBox
                        label="Wdh. gesamt"
                        value={selectedTrainingTotals.reps.toString()}
                      />

                      <StatBox
                        label="Ø Wdh./Satz"
                        value={selectedTrainingTotals.averageReps.toString()}
                      />
                    </>
                  )}

                  {selectedTrainingExercise.type === "time" && (
                    <>
                      <StatBox
                        label="Zeit gesamt"
                        value={`${selectedTrainingTotals.timeSeconds} sek`}
                      />

                      <StatBox
                        label="Ø Zeit/Satz"
                        value={`${roundOne(
                          selectedTrainingTotals.averageTimeSeconds
                        )} sek`}
                      />
                    </>
                  )}
                </div>

                <div className="sub-card inner">
                  <h3>Gewicht pro Satz</h3>
                  <SimpleLineChart
                    data={selectedWeightChartData}
                    unit="kg"
                    color="#60a5fa"
                    xLabel="Satz / Datum"
                    yLabel="Gewicht kg"
                  />
                </div>

                {selectedTrainingExercise.type === "reps" && (
                  <div className="sub-card inner">
                    <h3>Wiederholungen pro Satz</h3>
                    <SimpleLineChart
                      data={selectedRepsChartData}
                      unit="Wdh."
                      color="#f97316"
                      xLabel="Satz / Datum"
                      yLabel="Wiederholungen"
                    />
                  </div>
                )}

                {selectedTrainingExercise.type === "time" && (
                  <div className="sub-card inner">
                    <h3>Zeit pro Satz</h3>
                    <SimpleLineChart
                      data={selectedTimeChartData}
                      unit="sek"
                      color="#f97316"
                      xLabel="Satz / Datum"
                      yLabel="Zeit sek"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {tab === "bouldern" && (
        <>

          <div className="boulder-statistics-tab-bar">
            <button
              type="button"
              className={
                boulderStatisticsTab === "overview"
                  ? "active-tab"
                  : ""
              }
              onClick={() =>
                setBoulderStatisticsTab("overview")
              }
            >
              Übersicht
            </button>

            <button
              type="button"
              className={
                boulderStatisticsTab === "timeline"
                  ? "active-tab"
                  : ""
              }
              onClick={() =>
                setBoulderStatisticsTab("timeline")
              }
            >
              Verlauf
            </button>

            <button
              type="button"
              className={
                boulderStatisticsTab === "styles"
                  ? "active-tab"
                  : ""
              }
              onClick={() =>
                setBoulderStatisticsTab("styles")
              }
            >
              Styles &amp; Grade
            </button>

            <button
              type="button"
              className={
                boulderStatisticsTab === "trends"
                  ? "active-tab"
                  : ""
              }
              onClick={() =>
                setBoulderStatisticsTab("trends")
              }
            >
              Trends
            </button>
          </div>

          {boulderStatisticsTab === "overview" && (
            <>
            <div className="sub-card">
              <h3>
                Bouldern ·{" "}
                {periodLabel(
                  periodMode,
                  selectedYear,
                  selectedMonth
                )}
              </h3>

              <div className="stats-grid">
                <StatBox
                  label="Boulder gesamt"
                  value={boulderItems.length.toString()}
                />

                <StatBox
                  label="Boulder-Sessions"
                  value={boulderSessionCount.toString()}
                />

                <StatBox
                  label="Boulder pro Session"
                  value={
                    bouldersPerSession?.toString() ??
                    "-"
                  }
                />

                <StatBox
                  label="Boulder letzte 30 Tage"
                  value={bouldersLast30Days.toString()}
                />

                <StatBox
                  label="Ø Grad"
                  value={
                    averageBoulderGrade?.toString() ??
                    "-"
                  }
                />

                <StatBox
                  label="Ø Grad letzte 30 Tage"
                  value={
                    averageGradeLast30Days?.toString() ??
                    "-"
                  }
                />

                <StatBox
                  label="Schwerster Grad"
                  value={
                    heaviestBoulderGrade
                      ? `G${heaviestBoulderGrade}`
                      : "-"
                  }
                />

                <StatBox
                  label="Hardest Flash"
                  value={
                    hardestFlashGrade
                      ? `G${hardestFlashGrade}`
                      : "-"
                  }
                />

                <StatBox
                  label="Flash-Rate"
                  value={
                    flashRate !== null
                      ? `${flashRate} %`
                      : "-"
                  }
                />
              </div>
            </div>
          </>
        )}

        {boulderStatisticsTab === "timeline" && (
          <>
            <div className="sub-card">
              <h3>Boulder im Zeitverlauf</h3>

              {aggregatedBoulderCount.length === 0 ? (
                <p>
                  Keine Boulder-Daten im ausgewählten
                  Zeitraum.
                </p>
              ) : (
                <SimpleBarChart
                  data={aggregatedBoulderCount}
                />
              )}
            </div>

            <div className="sub-card">
              <h3>
                Boulder-Sessions im Zeitverlauf
              </h3>

              {aggregatedBoulderSessions.length ===
              0 ? (
                <p>
                  Keine Boulder-Sessions im
                  ausgewählten Zeitraum.
                </p>
              ) : (
                <SimpleBarChart
                  data={aggregatedBoulderSessions}
                />
              )}
            </div>

            <div className="sub-card">
              <h3>
                Durchschnittlicher Grad im
                Zeitverlauf
              </h3>

              {aggregatedAverageGrade.length === 0 ? (
                <p>
                  Keine Grade im ausgewählten
                  Zeitraum.
                </p>
              ) : (
                <SimpleLineChart
                  data={aggregatedAverageGrade}
                  unit="Grad"
                  color="#a78bfa"
                  xLabel="Zeitraum"
                  yLabel="Ø Grad"
                />
              )}
            </div>

            <div className="sub-card">
              <h3>Verlaufsfilter</h3>

              <div className="form-block compact">
                <label className="field-label">
                  Style
                </label>

                <select
                  value={selectedTimelineStyle}
                  onChange={(event) =>
                    setSelectedTimelineStyle(
                      event.target.value as
                        | BoulderStyle
                        | "all"
                    )
                  }
                >
                  <option value="all">
                    Alle Styles
                  </option>

                  {boulderStyles.map((style) => (
                    <option
                      key={style}
                      value={style}
                    >
                      {style}
                    </option>
                  ))}
                </select>
              </div>

              <p className="hint">
                Der Style-Filter gilt für Boulderanzahl,
                Sessions und Flash-Rate je Grad. Bei
                „Alle Styles“ werden alle Styles gemeinsam
                ausgewertet.
              </p>
            </div>

            <div className="sub-card">
               <h3>
                {selectedTimelineStyle === "all"
                  ? "Boulder je Grad im Zeitverlauf"
                  : `Boulder je Grad und Style im Zeitverlauf · ${selectedTimelineStyle}`}
              </h3>

              <p className="hint">
                Grade auswählen, die im Diagramm
                verglichen werden sollen.
              </p>

              <div className="grade-filter">
                {boulderGradesWithData.map((grade) => {
                  const isSelected =
                    selectedBoulderGrades.includes(
                      grade
                    );

                  return (
                    <button
                      key={grade}
                      type="button"
                      className={
                        isSelected
                          ? "grade-filter-button active"
                          : "grade-filter-button"
                      }
                      onClick={() =>
                        toggleBoulderGrade(grade)
                      }
                    >
                      G{grade}
                    </button>
                  );
                })}
              </div>

              {visibleBoulderGrades.length === 0 ? (
                <p>
                  Bitte mindestens einen Grad
                  auswählen.
                </p>
              ) : boulderGradeTimelineData.length ===
                0 ? (
                <p>
                  Keine Boulder-Daten für die
                  ausgewählten Grade vorhanden.
                </p>
              ) : (
                <MultiLineChart
                  data={boulderGradeTimelineData}
                  series={visibleBoulderGrades.map(
                    (grade) => `G${grade}`
                  )}
                  colors={visibleBoulderGrades.map(
                    (grade) =>
                      gradeColors[
                        (grade - 1) %
                          gradeColors.length
                      ]
                  )}
                  xLabel="Zeitraum"
                  yLabel="Anzahl Boulder"
                  unit="Boulder"
                />
              )}
            </div>

            <div className="sub-card">
              <h3>
                {selectedTimelineStyle === "all"
                  ? "Sessions je Grad im Zeitverlauf"
                  : `Sessions je Grad und Style im Zeitverlauf · ${selectedTimelineStyle}`}
              </h3>

              <p className="hint">
                Durchschnittliche Anzahl unterschiedlicher
                Sessions je Boulderproblem und Zeitraum.
              </p>

              {visibleBoulderGrades.length === 0 ? (
                <p>
                  Bitte mindestens einen Grad auswählen.
                </p>
              ) : sessionsByGradeTimelineData.length ===
                0 ? (
                <p>
                  Keine Session-Daten für die aktuelle
                  Auswahl vorhanden.
                </p>
              ) : (
                <MultiLineChart
                  data={sessionsByGradeTimelineData}
                  series={visibleBoulderGrades.map(
                    (grade) => `G${grade}`
                  )}
                  colors={visibleBoulderGrades.map(
                    (grade) =>
                      gradeColors[
                        (grade - 1) %
                          gradeColors.length
                      ]
                  )}
                  xLabel="Zeitraum"
                  yLabel="Ø Sessions"
                  unit="Sessions"
                />
              )}
            </div>

            <div className="sub-card">
              <h3>
                {selectedTimelineStyle === "all"
                  ? "Flash-Rate je Grad im Zeitverlauf"
                  : `Flash-Rate je Grad und Style im Zeitverlauf · ${selectedTimelineStyle}`}
              </h3>

              <p className="hint">
                Anteil der geflashten Boulder je Grad und
                Zeitraum. Boulder ohne Flash-Information
                werden nicht berücksichtigt.
              </p>

              {visibleBoulderGrades.length === 0 ? (
                <p>
                  Bitte mindestens einen Grad auswählen.
                </p>
              ) : flashRateByGradeTimelineData.length ===
                0 ? (
                <p>
                  Keine Flash-Daten für die aktuelle
                  Auswahl vorhanden.
                </p>
              ) : (
                <MultiLineChart
                  data={flashRateByGradeTimelineData}
                  series={visibleBoulderGrades.map(
                    (grade) => `G${grade}`
                  )}
                  colors={visibleBoulderGrades.map(
                    (grade) =>
                      gradeColors[
                        (grade - 1) %
                          gradeColors.length
                      ]
                  )}
                  xLabel="Zeitraum"
                  yLabel="Flash-Rate %"
                  unit="%"
                />
              )}
            </div>

          </>
        )}

        {boulderStatisticsTab === "styles" && (
          <>
            <div className="sub-card">
              <h3>Leistungsniveau je Style</h3>

              <p className="hint">
                Durchschnittlicher Bouldergrad je
                Style. Boulder ohne Style oder Grad
                werden nicht berücksichtigt.
              </p>

              {averageGradeByStyle.length === 0 ? (
                <p>
                  Noch keine geeigneten Style- und
                  Grad-Daten vorhanden.
                </p>
              ) : (
                <div className="style-performance-list">
                  {averageGradeByStyle.map((item) => (
                    <div
                      key={item.style}
                      className="style-performance-row"
                    >
                      <div>
                        <strong>{item.style}</strong>
                        <span>n = {item.count}</span>
                      </div>

                      <strong className="style-performance-value">
                        Ø {item.average}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sub-card">
              <h3>Boulder je Grad</h3>

              {boulderGradeChartData.length === 0 ? (
                <p>
                  Keine Boulder-Daten im ausgewählten
                  Zeitraum.
                </p>
              ) : (
                <>
                  <SimpleBarChart
                    data={boulderGradeChartData}
                  />

                  <div className="stats-list">
                    {boulderGradesWithData.map(
                      (grade) => {
                        const count =
                          getBoulderCountByGrade(grade);

                        const sessionData =
                          sessionsByGrade.find(
                            (item) =>
                              item.grade === grade
                          );

                        return (
                          <div
                            key={grade}
                            className="stats-row"
                          >
                            <span>Grad {grade}</span>

                            <span>
                              {count} Boulder
                            </span>

                            <span>
                              Ø{" "}
                              {sessionData?.averageSessions ??
                                "-"}{" "}
                              Sessions
                            </span>

                            <span>
                              n ={" "}
                              {sessionData?.count ?? count}
                            </span>
                          </div>
                        );
                      }
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="sub-card">
              <h3>Boulder nach Style und Grad</h3>

              {boulderGradesWithData.length === 0 ? (
                <p>
                  Keine Boulder-Daten im ausgewählten
                  Zeitraum.
                </p>
              ) : (
                <div className="boulder-table">
                  <div
                    className="boulder-table-header dynamic-grade-table"
                    style={{
                      gridTemplateColumns: `110px repeat(${boulderGradesWithData.length}, 54px)`,
                    }}
                  >
                    <span>Style</span>

                    {boulderGradesWithData.map(
                      (grade) => (
                        <span key={grade}>
                          G{grade}
                        </span>
                      )
                    )}
                  </div>

                  {boulderStyles.map((style) => {
                    const rowHasData =
                      boulderGradesWithData.some(
                        (grade) =>
                          getBoulderCountByStyleAndGrade(
                            style,
                            grade
                          ) > 0
                      );

                    if (!rowHasData) {
                      return null;
                    }

                    return (
                      <div
                        key={style}
                        className="boulder-table-row dynamic-grade-table"
                        style={{
                          gridTemplateColumns: `110px repeat(${boulderGradesWithData.length}, 54px)`,
                        }}
                      >
                        <span>{style}</span>

                        {boulderGradesWithData.map(
                          (grade) => (
                            <span
                              key={`${style}-${grade}`}
                            >
                              {getBoulderCountByStyleAndGrade(
                                style,
                                grade
                              )}
                            </span>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="sub-card">
              <h3>Sessions je Grad und Style</h3>

              <p className="hint">
                Durchschnittliche Anzahl unterschiedlicher
                Sessions je Boulderproblem.
              </p>

              {boulderGradesWithData.length === 0 ? (
                <p>
                  Keine Boulder-Daten im ausgewählten Zeitraum.
                </p>
              ) : (
                <div className="boulder-table">
                  <div
                    className="boulder-table-header dynamic-grade-table"
                    style={{
                      gridTemplateColumns: `110px repeat(${boulderGradesWithData.length}, 70px)`,
                    }}
                  >
                    <span>Style</span>

                    {boulderGradesWithData.map((grade) => (
                      <span key={grade}>
                        G{grade}
                      </span>
                    ))}
                  </div>

                  {boulderStyles.map((style) => {
                    const rowHasData =
                      boulderGradesWithData.some(
                        (grade) =>
                          getAverageSessionsByStyleAndGrade(
                            style,
                            grade
                          ) !== null
                      );

                    if (!rowHasData) {
                      return null;
                    }

                    return (
                      <div
                        key={style}
                        className="boulder-table-row dynamic-grade-table"
                        style={{
                          gridTemplateColumns: `110px repeat(${boulderGradesWithData.length}, 70px)`,
                        }}
                      >
                        <span>{style}</span>

                        {boulderGradesWithData.map((grade) => {
                          const value =
                            getAverageSessionsByStyleAndGrade(
                              style,
                              grade
                            );

                          return (
                            <span key={`${style}-${grade}`}>
                              {value !== null
                                ? `Ø ${value}`
                                : "-"}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="sub-card">
              <h3>Flash-Rate je Grad</h3>

              <p className="hint">
                Boulder ohne gespeicherte Flash-Information
                werden nicht berücksichtigt.
              </p>

              {flashRateByGrade.length === 0 ? (
                <p>
                  Noch keine Flash-Daten vorhanden.
                </p>
              ) : (
                <div className="stats-list">
                  {flashRateByGrade.map((item) => (
                    <div
                      key={item.grade}
                      className="stats-row"
                    >
                      <span>
                        Grad {item.grade}
                      </span>

                      <span>
                        {item.flashRate} %
                      </span>

                      <span>
                        {item.flashes} Flash
                      </span>

                      <span>
                        n = {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="sub-card">
              <h3>Flash-Rate je Grad und Style</h3>

              <p className="hint">
                Flash-Anteil je Kombination aus Style und Grad.
              </p>

              {boulderGradesWithData.length === 0 ? (
                <p>
                  Keine Boulder-Daten im ausgewählten Zeitraum.
                </p>
              ) : (
                <div className="boulder-table">
                  <div
                    className="boulder-table-header dynamic-grade-table"
                    style={{
                      gridTemplateColumns: `110px repeat(${boulderGradesWithData.length}, 72px)`,
                    }}
                  >
                    <span>Style</span>

                    {boulderGradesWithData.map((grade) => (
                      <span key={grade}>
                        G{grade}
                      </span>
                    ))}
                  </div>

                  {boulderStyles.map((style) => {
                    const rowHasData =
                      boulderGradesWithData.some(
                        (grade) =>
                          getFlashRateByStyleAndGrade(
                            style,
                            grade
                          ) !== null
                      );

                    if (!rowHasData) {
                      return null;
                    }

                    return (
                      <div
                        key={style}
                        className="boulder-table-row dynamic-grade-table"
                        style={{
                          gridTemplateColumns: `110px repeat(${boulderGradesWithData.length}, 72px)`,
                        }}
                      >
                        <span>{style}</span>

                        {boulderGradesWithData.map((grade) => {
                          const result =
                            getFlashRateByStyleAndGrade(
                              style,
                              grade
                            );

                          return (
                            <span
                              key={`${style}-${grade}`}
                              title={
                                result
                                  ? `${result.flashes} von ${result.count} geflasht`
                                  : "Keine Daten"
                              }
                            >
                              {result
                                ? `${result.rate} %`
                                : "-"}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {boulderStatisticsTab === "trends" && (
          <>
            <div className="sub-card">
              <h3>Rollierende Trends</h3>

              <p className="hint">
                Der aktuelle Zeitraum wird mit dem
                unmittelbar vorherigen gleich langen
                Zeitraum verglichen.
              </p>

              <div className="form-block compact">
                <label className="field-label">
                  Vergleichszeitraum
                </label>

                <select
                  value={trendRangeDays}
                  onChange={(event) =>
                    setTrendRangeDays(
                      Number(
                        event.target.value
                      ) as TrendRangeDays
                    )
                  }
                >
                  <option value={30}>
                    Letzte 30 Tage
                  </option>

                  <option value={90}>
                    Letzte 90 Tage
                  </option>

                  <option value={180}>
                    Letzte 180 Tage
                  </option>

                  <option value={365}>
                    Letzte 365 Tage
                  </option>
                </select>
              </div>

              <div className="trend-period-info">
                <div>
                  <span>Aktuell</span>

                  <strong>
                    {trendPeriod.currentStart} bis{" "}
                    {trendPeriod.currentEnd}
                  </strong>
                </div>

                <div>
                  <span>Vergleich</span>

                  <strong>
                    {trendPeriod.previousStart} bis{" "}
                    {trendPeriod.previousEnd}
                  </strong>
                </div>
              </div>

              <div className="trend-grid">
                <TrendCard
                  label="Boulder gesamt"
                  trend={totalBoulderTrend}
                  valueSuffix=" Boulder"
                />

                <TrendCard
                  label="Boulder-Sessions"
                  trend={boulderSessionTrend}
                  valueSuffix=" Sessions"
                />

                <TrendCard
                  label="Ø Grad"
                  trend={averageGradeTrend}
                  valueSuffix=""
                  minimumLabel={`n = ${averageGradeTrend.previousCount} → ${averageGradeTrend.currentCount}`}
                />

                <FlashTrendCard
                  label="Flash-Rate"
                  trend={trendFlashRate}
                />
              </div>
            </div>

            <div className="sub-card">
              <h3>Trend je Grad</h3>

              <p className="hint">
                Anzahl Boulder je ausgewähltem Grad.
                Mindestens zwei Boulder je Zeitraum
                werden benötigt.
              </p>

              <div className="grade-filter">
                {boulderGradesWithData.map((grade) => {
                  const isSelected =
                    selectedBoulderGrades.includes(
                      grade
                    );

                  return (
                    <button
                      key={grade}
                      type="button"
                      className={
                        isSelected
                          ? "grade-filter-button active"
                          : "grade-filter-button"
                      }
                      onClick={() =>
                        toggleBoulderGrade(grade)
                      }
                    >
                      G{grade}
                    </button>
                  );
                })}
              </div>

              {gradeCountTrends.length === 0 ? (
                <p>
                  Keine Grade für den Trend ausgewählt.
                </p>
              ) : (
                <div className="trend-grid">
                  {gradeCountTrends.map(
                    ({ grade, trend }) => (
                      <TrendCard
                        key={grade}
                        label={`Grad ${grade}`}
                        trend={trend}
                        valueSuffix=" Boulder"
                      />
                    )
                  )}
                </div>
              )}
            </div>

            <div className="sub-card">
              <h3>Flash-Trend je Grad</h3>

              <p className="hint">
                Veränderung der Flash-Rate je
                ausgewähltem Grad. Die Differenz wird in
                Prozentpunkten angegeben. Mindestens fünf
                Boulder mit Flash-Information pro
                Vergleichszeitraum werden benötigt.
              </p>

              {gradeFlashRateTrends.length === 0 ? (
                <p>
                  Keine Grade für den Trend ausgewählt.
                </p>
              ) : (
                <div className="trend-grid">
                  {gradeFlashRateTrends.map(
                    ({ grade, trend }) => (
                      <FlashTrendCard
                        key={grade}
                        label={`Grad ${grade}`}
                        trend={trend}
                      />
                    )
                  )}
                </div>
              )}
            </div>

            <div className="sub-card">
              <h3>
                Flash-Trend je Grad und Style
              </h3>

              <p className="hint">
                Veränderung der Flash-Rate je Kombination
                aus Style und ausgewähltem Grad.
              </p>

              {styleGradeFlashRateTrends.length === 0 ? (
                <p>
                  Keine Style-/Grad-Daten für den
                  Flash-Vergleich.
                </p>
              ) : (
                <div className="trend-grid">
                  {styleGradeFlashRateTrends.map(
                    ({ style, grade, trend }) => (
                      <FlashTrendCard
                        key={`${style}-${grade}`}
                        label={`${style} · G${grade}`}
                        trend={trend}
                      />
                    )
                  )}
                </div>
              )}
            </div>

            <div className="sub-card">
              <h3>Sessions-Trend je Grad</h3>

              <p className="hint">
                Vergleich der durchschnittlich benötigten
                Sessions je Boulderproblem. Ein sinkender
                Wert wird als Verbesserung bewertet.
                Mindestens zwei Boulder mit
                Session-Information pro Zeitraum werden
                benötigt.
              </p>

              {gradeSessionsTrends.length === 0 ? (
                <p>
                  Keine Grade für den Trend ausgewählt.
                </p>
              ) : (
                <div className="trend-grid">
                  {gradeSessionsTrends.map(
                    ({ grade, trend }) => (
                      <SessionsTrendCard
                        key={grade}
                        label={`Grad ${grade}`}
                        trend={trend}
                      />
                    )
                  )}
                </div>
              )}
            </div>

            <div className="sub-card">
              <h3>
                Sessions-Trend je Grad und Style
              </h3>

              <p className="hint">
                Vergleich der durchschnittlich benötigten
                Sessions je Kombination aus Style und
                ausgewähltem Grad. Weniger Sessions werden
                als positive Entwicklung dargestellt.
              </p>

              {styleGradeSessionsTrends.length === 0 ? (
                <p>
                  Keine Style-/Grad-Daten für den
                  Sessions-Vergleich.
                </p>
              ) : (
                <div className="trend-grid">
                  {styleGradeSessionsTrends.map(
                    ({ style, grade, trend }) => (
                      <SessionsTrendCard
                        key={`${style}-${grade}`}
                        label={`${style} · G${grade}`}
                        trend={trend}
                      />
                    )
                  )}
                </div>
              )}
            </div>

            <div className="sub-card">
              <h3>Durchschnittsgrad je Style</h3>

              <p className="hint">
                Vergleich des durchschnittlichen Grades
                je Style. Mindestens drei Boulder mit
                Grad pro Zeitraum werden benötigt.
              </p>

              {styleAverageGradeTrends.length ===
              0 ? (
                <p>
                  Keine Style-Daten für den Vergleich.
                </p>
              ) : (
                <div className="trend-grid">
                  {styleAverageGradeTrends.map(
                    ({ style, trend }) => (
                      <TrendCard
                        key={style}
                        label={style}
                        trend={trend}
                        valueSuffix=""
                        minimumLabel={`n = ${trend.previousCount} → ${trend.currentCount}`}
                      />
                    )
                  )}
                </div>
              )}
            </div>

            <div className="sub-card">
              <h3>Trend je Grad und Style</h3>

              <p className="hint">
                Anzahl Boulder je Kombination aus Style
                und ausgewähltem Grad.
              </p>

              {styleGradeCountTrends.length === 0 ? (
                <p>
                  Keine Style-/Grad-Daten für den
                  Vergleich.
                </p>
              ) : (
                <div className="trend-grid">
                  {styleGradeCountTrends.map(
                    ({ style, grade, trend }) => (
                      <TrendCard
                        key={`${style}-${grade}`}
                        label={`${style} · G${grade}`}
                        trend={trend}
                        valueSuffix=" Boulder"
                      />
                    )
                  )}
                </div>
              )}
            </div>
          </>
        )}
        </>
      )}

      {tab === "body" && (
        <>
          <div className="sub-card">
            <h3>
              Körper · {periodLabel(periodMode, selectedYear, selectedMonth)}
            </h3>

            {!latestBody ? (
              <p>Noch keine Körperdaten im ausgewählten Zeitraum.</p>
            ) : (
              <div className="stats-grid">
                <StatBox label="Gewicht" value={`${latestBody.weightKg} kg`} />
                <StatBox
                  label="KFA Final"
                  value={`${latestBody.bodyFatPercent} %`}
                />
                <StatBox label="BMI" value={latestBody.bmi.toString()} />
                <StatBox
                  label="Messungen"
                  value={filteredBodyMeasurements.length.toString()}
                />
              </div>
            )}
          </div>

          <div className="sub-card">
            <h3>Gewichtverlauf</h3>

            {bodyWeightChartData.length === 0 ? (
              <p>Noch keine Gewichtsdaten im ausgewählten Zeitraum.</p>
            ) : (
              <SimpleLineChart
                data={bodyWeightChartData}
                unit="kg"
                color="#34d399"
                xLabel="Zeitraum"
                yLabel="Gewicht kg"
              />
            )}
          </div>

          <div className="sub-card">
            <h3>KFA-Verlauf</h3>

            {bodyFatChartData.length === 0 ? (
              <p>Noch keine KFA-Daten im ausgewählten Zeitraum.</p>
            ) : (
              <SimpleLineChart
                data={bodyFatChartData}
                unit="%"
                color="#f97316"
                xLabel="Zeitraum"
                yLabel="KFA %"
              />
            )}
          </div>

          {latestBody && (
            <div className="sub-card">
              <h3>Letzte Messung</h3>

              <div className="stats-list">
                <div className="stats-row two-columns">
                  <span>Datum</span>
                  <span>{latestBody.date}</span>
                </div>

                <div className="stats-row two-columns">
                  <span>Gewicht</span>
                  <span>{latestBody.weightKg} kg</span>
                </div>

                <div className="stats-row two-columns">
                  <span>KFA Final</span>
                  <span>{latestBody.bodyFatPercent} %</span>
                </div>

                <div className="stats-row two-columns">
                  <span>BMI</span>
                  <span>{latestBody.bmi}</span>
                </div>

                {previousBody && (
                  <>
                    <div className="stats-row two-columns">
                      <span>Gewicht Δ</span>
                      <span>
                        {roundOne(latestBody.weightKg - previousBody.weightKg)}{" "}
                        kg
                      </span>
                    </div>

                    <div className="stats-row two-columns">
                      <span>KFA Δ</span>
                      <span>
                        {roundOne(
                          latestBody.bodyFatPercent -
                            previousBody.bodyFatPercent
                        )}{" "}
                        %
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-box">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TrendCard({
  label,
  trend,
  valueSuffix,
  minimumLabel,
}: {
  label: string;
  trend: TrendValue;
  valueSuffix: string;
  minimumLabel?: string;
}) {
  const statusClass =
    trend.status === "increase"
      ? "positive"
      : trend.status === "decrease"
      ? "negative"
      : trend.status === "new"
      ? "new"
      : "neutral";

  function formatTrendHeadline() {
    if (trend.status === "insufficient") {
      return "Nicht genügend Daten";
    }

    if (trend.status === "new") {
      return "Neu";
    }

    if (trend.status === "unchanged") {
      return "0 %";
    }

    const prefix =
      trend.percentChange !== null &&
      trend.percentChange > 0
        ? "+"
        : "";

    return `${prefix}${
      trend.percentChange ?? 0
    } %`;
  }

  return (
    <div
      className={`trend-card ${statusClass}`}
    >
      <span className="trend-card-label">
        {label}
      </span>

      <strong className="trend-card-value">
        {formatTrendHeadline()}
      </strong>

      <span className="trend-card-comparison">
        {trend.previous}
        {valueSuffix} → {trend.current}
        {valueSuffix}
      </span>

      {minimumLabel && (
        <span className="trend-card-sample">
          {minimumLabel}
        </span>
      )}
    </div>
  );
}

function FlashTrendCard({
  label,
  trend,
}: {
  label: string;
  trend: FlashRateTrendValue;
}) {
  const statusClass =
    trend.status === "increase"
      ? "positive"
      : trend.status === "decrease"
      ? "negative"
      : "neutral";

  const prefix =
    trend.differencePoints > 0
      ? "+"
      : "";

  return (
    <div
      className={`trend-card ${statusClass}`}
    >
      <span className="trend-card-label">
        {label}
      </span>

      <strong className="trend-card-value">
        {trend.status === "insufficient"
          ? "Nicht genügend Daten"
          : `${prefix}${trend.differencePoints} Prozentpunkte`}
      </strong>

      <span className="trend-card-comparison">
        {trend.previousRate} % →{" "}
        {trend.currentRate} %
      </span>

      <span className="trend-card-sample">
        n = {trend.previousCount} →{" "}
        {trend.currentCount}
      </span>
    </div>
  );
}

function SessionsTrendCard({
  label,
  trend,
}: {
  label: string;
  trend: SessionsTrendValue;
}) {
  const statusClass =
    trend.status === "increase"
      ? "positive"
      : trend.status === "decrease"
      ? "negative"
      : "neutral";

  function formatHeadline() {
    if (trend.status === "insufficient") {
      return "Nicht genügend Daten";
    }

    if (
      trend.status === "unchanged" ||
      trend.percentChange === 0
    ) {
      return "0 %";
    }

    if (trend.percentChange === null) {
      return "-";
    }

    const prefix =
      trend.percentChange > 0
        ? "+"
        : "";

    return `${prefix}${trend.percentChange} %`;
  }

  return (
    <div
      className={`trend-card ${statusClass}`}
    >
      <span className="trend-card-label">
        {label}
      </span>

      <strong className="trend-card-value">
        {formatHeadline()}
      </strong>

      <span className="trend-card-comparison">
        Ø {trend.previous} → Ø{" "}
        {trend.current} Sessions
      </span>

      <span className="trend-card-sample">
        n = {trend.previousCount} →{" "}
        {trend.currentCount}
      </span>

      {trend.status !== "insufficient" && (
        <span className="trend-card-sample">
          Weniger Sessions werden als
          Verbesserung bewertet.
        </span>
      )}
    </div>
  );
}

function SimpleBarChart({ data }: { data: ChartItem[] }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="simple-chart">
      {data.map((item) => {
        const width = `${Math.max(6, (item.value / maxValue) * 100)}%`;

        return (
          <div key={item.label} className="simple-bar-row">
            <span className="simple-chart-label">{item.label}</span>

            <div className="simple-bar-track">
              <div className="simple-bar-fill" style={{ width }} />
            </div>

            <span className="simple-chart-value">{item.value}</span>
          </div>
        );
      })}
    </div>
  );
}

function SimpleLineChart({
  data,
  unit,
  color,
  xLabel,
  yLabel,
}: {
  data: ChartItem[];
  unit: string;
  color: string;
  xLabel: string;
  yLabel: string;
}) {
  const validData = data.filter((item) => Number.isFinite(item.value));

  if (validData.length === 0) {
    return <p>Keine gültigen Daten vorhanden.</p>;
  }

  const values = validData.map((item) => item.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const midValue = roundOne((minValue + maxValue) / 2);
  const range = maxValue - minValue || 1;

  const width = 360;
  const height = 230;
  const paddingLeft = 54;
  const paddingRight = 18;
  const paddingTop = 22;
  const paddingBottom = 48;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const points = validData.map((item, index) => {
    const x =
      validData.length === 1
        ? paddingLeft + chartWidth / 2
        : paddingLeft + (index / (validData.length - 1)) * chartWidth;

    const y =
      paddingTop +
      chartHeight -
      ((item.value - minValue) / range) * chartHeight;

    return {
      x,
      y,
      index,
      ...item,
    };
  });

  const polylinePoints = points
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  const firstLabel = validData[0]?.label ?? "";
  const lastLabel = validData[validData.length - 1]?.label ?? "";

  return (
    <div className="line-chart-box">
      <svg viewBox={`0 0 ${width} ${height}`} className="line-chart-svg">
        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={paddingTop + chartHeight}
          stroke="#3f3f46"
          strokeWidth="1"
        />

        <line
          x1={paddingLeft}
          y1={paddingTop + chartHeight}
          x2={paddingLeft + chartWidth}
          y2={paddingTop + chartHeight}
          stroke="#3f3f46"
          strokeWidth="1"
        />

        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft + chartWidth}
          y2={paddingTop}
          stroke="#27272a"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        <line
          x1={paddingLeft}
          y1={paddingTop + chartHeight / 2}
          x2={paddingLeft + chartWidth}
          y2={paddingTop + chartHeight / 2}
          stroke="#27272a"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        <text
          x={paddingLeft - 8}
          y={paddingTop + 4}
          textAnchor="end"
          className="svg-axis-text"
        >
          {roundOne(maxValue)}
        </text>

        <text
          x={paddingLeft - 8}
          y={paddingTop + chartHeight / 2 + 4}
          textAnchor="end"
          className="svg-axis-text"
        >
          {midValue}
        </text>

        <text
          x={paddingLeft - 8}
          y={paddingTop + chartHeight + 4}
          textAnchor="end"
          className="svg-axis-text"
        >
          {roundOne(minValue)}
        </text>

        {validData.length > 1 && (
          <polyline
            points={polylinePoints}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {points.map((point) => (
          <circle
            key={`${point.label}-${point.index}`}
            cx={point.x}
            cy={point.y}
            r="4"
            fill={color}
          />
        ))}

        <text
          x={paddingLeft}
          y={height - 25}
          textAnchor="start"
          className="svg-axis-text"
        >
          {firstLabel}
        </text>

        <text
          x={paddingLeft + chartWidth}
          y={height - 25}
          textAnchor="end"
          className="svg-axis-text"
        >
          {lastLabel}
        </text>

        <text
          x={paddingLeft + chartWidth / 2}
          y={height - 6}
          textAnchor="middle"
          className="svg-axis-label"
        >
          X: {xLabel}
        </text>

        <text
          x={16}
          y={paddingTop + chartHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${paddingTop + chartHeight / 2})`}
          className="svg-axis-label"
        >
          Y: {yLabel}
        </text>
      </svg>

      <div className="line-chart-summary">
        <span>
          Min: {roundOne(minValue)} {unit}
        </span>
        <span>
          Max: {roundOne(maxValue)} {unit}
        </span>
        <span>
          Letzt: {roundOne(validData[validData.length - 1].value)} {unit}
        </span>
      </div>
    </div>
  );
}

function MultiLineChart({
  data,
  series,
  colors,
  xLabel,
  yLabel,
  unit,
}: {
  data: MultiLineChartPoint[];
  series: string[];
  colors: string[];
  xLabel: string;
  yLabel: string;
  unit: string;
}) {
  const validSeries = series.filter((seriesName) =>
    data.some((point) => Number(point.values[seriesName] ?? 0) > 0)
  );

  if (data.length === 0 || validSeries.length === 0) {
    return <p>Keine gültigen Daten vorhanden.</p>;
  }

  const allValues = data.flatMap((point) =>
    validSeries.map((seriesName) => Number(point.values[seriesName] ?? 0))
  );

  const minValue = 0;
  const maxValue = Math.max(...allValues, 1);
  const midValue = roundOne((minValue + maxValue) / 2);
  const range = maxValue - minValue || 1;

  const width = 360;
  const height = 240;
  const paddingLeft = 54;
  const paddingRight = 18;
  const paddingTop = 22;
  const paddingBottom = 54;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  function getPointX(index: number) {
    if (data.length === 1) {
      return paddingLeft + chartWidth / 2;
    }

    return paddingLeft + (index / (data.length - 1)) * chartWidth;
  }

  function getPointY(value: number) {
    return paddingTop + chartHeight - ((value - minValue) / range) * chartHeight;
  }

  const firstLabel = data[0]?.label ?? "";
  const lastLabel = data[data.length - 1]?.label ?? "";

  return (
    <div className="line-chart-box">
      <svg viewBox={`0 0 ${width} ${height}`} className="line-chart-svg">
        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={paddingTop + chartHeight}
          stroke="#3f3f46"
          strokeWidth="1"
        />

        <line
          x1={paddingLeft}
          y1={paddingTop + chartHeight}
          x2={paddingLeft + chartWidth}
          y2={paddingTop + chartHeight}
          stroke="#3f3f46"
          strokeWidth="1"
        />

        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft + chartWidth}
          y2={paddingTop}
          stroke="#27272a"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        <line
          x1={paddingLeft}
          y1={paddingTop + chartHeight / 2}
          x2={paddingLeft + chartWidth}
          y2={paddingTop + chartHeight / 2}
          stroke="#27272a"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        <text
          x={paddingLeft - 8}
          y={paddingTop + 4}
          textAnchor="end"
          className="svg-axis-text"
        >
          {roundOne(maxValue)}
        </text>

        <text
          x={paddingLeft - 8}
          y={paddingTop + chartHeight / 2 + 4}
          textAnchor="end"
          className="svg-axis-text"
        >
          {midValue}
        </text>

        <text
          x={paddingLeft - 8}
          y={paddingTop + chartHeight + 4}
          textAnchor="end"
          className="svg-axis-text"
        >
          {minValue}
        </text>

        {validSeries.map((seriesName, seriesIndex) => {
          const color = colors[seriesIndex % colors.length];

          const points = data.map((point, index) => {
            const value = Number(point.values[seriesName] ?? 0);

            return {
              x: getPointX(index),
              y: getPointY(value),
              value,
              label: point.label,
            };
          });

          const polylinePoints = points
            .map((point) => `${point.x},${point.y}`)
            .join(" ");

          return (
            <g key={seriesName}>
              {data.length > 1 && (
                <polyline
                  points={polylinePoints}
                  fill="none"
                  stroke={color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {points.map((point, pointIndex) => (
                <circle
                  key={`${seriesName}-${point.label}-${pointIndex}`}
                  cx={point.x}
                  cy={point.y}
                  r="3.5"
                  fill={color}
                />
              ))}
            </g>
          );
        })}

        <text
          x={paddingLeft}
          y={height - 30}
          textAnchor="start"
          className="svg-axis-text"
        >
          {firstLabel}
        </text>

        <text
          x={paddingLeft + chartWidth}
          y={height - 30}
          textAnchor="end"
          className="svg-axis-text"
        >
          {lastLabel}
        </text>

        <text
          x={paddingLeft + chartWidth / 2}
          y={height - 8}
          textAnchor="middle"
          className="svg-axis-label"
        >
          X: {xLabel}
        </text>

        <text
          x={16}
          y={paddingTop + chartHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 16 ${paddingTop + chartHeight / 2})`}
          className="svg-axis-label"
        >
          Y: {yLabel}
        </text>
      </svg>

      <div className="chart-legend">
        {validSeries.map((seriesName, index) => (
          <span key={seriesName}>
            <span
              className="chart-legend-color"
              style={{
                background: colors[index % colors.length],
              }}
            />
            {seriesName}
          </span>
        ))}
      </div>

      <div className="line-chart-summary">
        <span>
          Min: {minValue} {unit}
        </span>
        <span>
          Max: {roundOne(maxValue)} {unit}
        </span>
        <span>Linien: {validSeries.length}</span>
      </div>
    </div>
  );
}