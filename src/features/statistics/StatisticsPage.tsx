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

type PeriodMode = "all" | "year" | "month";
type StatisticsTab = "training" | "bouldern" | "body";

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

function getDayFromDate(date: string) {
  return Number(date.slice(8, 10));
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
  const [dataMenuOpen, setDataMenuOpen] = useState(false);

  const [periodMode, setPeriodMode] = useState<PeriodMode>("year");
  const [selectedYear, setSelectedYear] = useState(todayYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

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
        "Boulder Versuche",
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
          item.boulderAttempts ?? "",
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

  function getAverageAttemptsByGrade(grade: BoulderGrade) {
    const items = boulderItems.filter(
      (item) =>
        item.boulderGrade === grade && item.boulderAttempts !== undefined
    );

    if (items.length === 0) return null;

    const total = items.reduce(
      (sum, item) => sum + (item.boulderAttempts ?? 0),
      0
    );

    return roundOne(total / items.length);
  }

  function getAverageAttemptsByStyleAndGrade(
    style: BoulderStyle,
    grade: BoulderGrade
  ) {
    const items = boulderItems.filter(
      (item) =>
        item.boulderStyle === style &&
        item.boulderGrade === grade &&
        item.boulderAttempts !== undefined
    );

    if (items.length === 0) return null;

    const total = items.reduce(
      (sum, item) => sum + (item.boulderAttempts ?? 0),
      0
    );

    return roundOne(total / items.length);
  }

  function getBouldersPerSessionByGrade(grade: BoulderGrade) {
    if (boulderSessionCount === 0) return null;

    const count = getBoulderCountByGrade(grade);

    if (count === 0) return null;

    return roundOne(count / boulderSessionCount);
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
      strengthItems.map((item) => item.diaryEntryId)
    );

    const strengthEntries = filteredEntries.filter(
      (entry) => entry.id !== undefined && strengthEntryIds.has(entry.id)
    );

    if (periodMode === "month") {
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

      return Array.from({ length: daysInMonth }).map((_, index) => {
        const day = index + 1;
        const count = strengthEntries.filter(
          (entry) => getDayFromDate(entry.date) === day
        ).length;

        return {
          label: day.toString(),
          value: count,
        };
      });
    }

    if (periodMode === "year") {
      return monthOptions.map((month) => {
        const count = strengthEntries.filter(
          (entry) => getMonthFromDate(entry.date) === month.value
        ).length;

        return {
          label: month.label.slice(0, 3),
          value: count,
        };
      });
    }

    const years = Array.from(
      new Set(strengthEntries.map((entry) => getYearFromDate(entry.date)))
    ).sort((a, b) => a - b);

    return years.map((year) => {
      const count = strengthEntries.filter(
        (entry) => getYearFromDate(entry.date) === year
      ).length;

      return {
        label: year.toString(),
        value: count,
      };
    });
  }, [strengthItems, filteredEntries, periodMode, selectedYear, selectedMonth]);

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

  const boulderGradeTimelineData = useMemo<MultiLineChartPoint[]>(() => {
    const dates = Array.from(
      new Set(
        boulderItems.map((item) => {
          const entry = entryMap.get(item.diaryEntryId);
          return entry?.date ?? item.createdAt.slice(0, 10);
        })
      )
    ).sort((a, b) => a.localeCompare(b));

    return dates.map((date) => {
      const values: Record<string, number> = {};

      boulderGradesWithData.forEach((grade) => {
        values[`G${grade}`] = boulderItems.filter((item) => {
          const entry = entryMap.get(item.diaryEntryId);
          const itemDate = entry?.date ?? item.createdAt.slice(0, 10);

          return itemDate === date && item.boulderGrade === grade;
        }).length;
      });

      return {
        label: date,
        values,
      };
    });
  }, [boulderItems, boulderGradesWithData, entryMap]);

  const bodyWeightChartData = useMemo(() => {
    return filteredBodyMeasurements.map((item) => ({
      label: item.date,
      value: Number(item.weightKg),
    }));
  }, [filteredBodyMeasurements]);

  const bodyFatChartData = useMemo(() => {
    return filteredBodyMeasurements.map((item) => ({
      label: item.date,
      value: Number(item.bodyFatPercent),
    }));
  }, [filteredBodyMeasurements]);

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
          <select
            value={periodMode}
            onChange={(event) => setPeriodMode(event.target.value as PeriodMode)}
          >
            <option value="all">Gesamt</option>
            <option value="year">Jahr</option>
            <option value="month">Monat</option>
          </select>

          {periodMode !== "all" && (
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          )}

          {periodMode === "month" && (
            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(Number(event.target.value))}
            >
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          )}
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
          <div className="sub-card">
            <h3>
              Bouldern · {periodLabel(periodMode, selectedYear, selectedMonth)}
            </h3>

            <div className="stats-grid">
              <StatBox label="Boulder" value={boulderItems.length.toString()} />
              <StatBox
                label="Boulder-Sessions"
                value={boulderSessionCount.toString()}
              />
              <StatBox
                label="Schwerster Grad"
                value={heaviestBoulderGrade ? `G${heaviestBoulderGrade}` : "-"}
              />
              <StatBox
                label="Ø Grad"
                value={averageBoulderGrade ? averageBoulderGrade.toString() : "-"}
              />
            </div>
          </div>

          <div className="sub-card">
            <h3>Boulder je Grad über Zeit</h3>

            {boulderGradeTimelineData.length === 0 ? (
              <p>Keine Boulder-Daten im ausgewählten Zeitraum.</p>
            ) : (
              <MultiLineChart
                data={boulderGradeTimelineData}
                series={boulderGradesWithData.map((grade) => `G${grade}`)}
                colors={gradeColors}
                xLabel="Datum"
                yLabel="Anzahl Boulder"
                unit="Boulder"
              />
            )}
          </div>

          <div className="sub-card">
            <h3>Boulder je Grad</h3>

            {boulderGradeChartData.length === 0 ? (
              <p>Keine Boulder-Daten im ausgewählten Zeitraum.</p>
            ) : (
              <SimpleBarChart data={boulderGradeChartData} />
            )}

            <div className="stats-list">
              {boulderGradesWithData.map((grade) => {
                const count = getBoulderCountByGrade(grade);
                const avgAttempts = getAverageAttemptsByGrade(grade);
                const perSession = getBouldersPerSessionByGrade(grade);

                return (
                  <div key={grade} className="stats-row">
                    <span>Grad {grade}</span>
                    <span>{count} Boulder</span>
                    <span>Ø {avgAttempts ?? "-"} Versuche</span>
                    <span>{perSession ?? "-"} / Session</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sub-card">
            <h3>Boulder nach Style und Grad</h3>

            {boulderGradesWithData.length === 0 ? (
              <p>Keine Boulder-Daten im ausgewählten Zeitraum.</p>
            ) : (
              <div className="boulder-table">
                <div
                  className="boulder-table-header dynamic-grade-table"
                  style={{
                    gridTemplateColumns: `110px repeat(${boulderGradesWithData.length}, 54px)`,
                  }}
                >
                  <span>Style</span>

                  {boulderGradesWithData.map((grade) => (
                    <span key={grade}>G{grade}</span>
                  ))}
                </div>

                {boulderStyles.map((style) => {
                  const rowHasData = boulderGradesWithData.some(
                    (grade) => getBoulderCountByStyleAndGrade(style, grade) > 0
                  );

                  if (!rowHasData) return null;

                  return (
                    <div
                      key={style}
                      className="boulder-table-row dynamic-grade-table"
                      style={{
                        gridTemplateColumns: `110px repeat(${boulderGradesWithData.length}, 54px)`,
                      }}
                    >
                      <span>{style}</span>

                      {boulderGradesWithData.map((grade) => (
                        <span key={`${style}-${grade}`}>
                          {getBoulderCountByStyleAndGrade(style, grade)}
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="sub-card">
            <h3>Ø Versuche nach Style und Grad</h3>

            {boulderGradesWithData.length === 0 ? (
              <p>Keine Boulder-Daten im ausgewählten Zeitraum.</p>
            ) : (
              <div className="boulder-table">
                <div
                  className="boulder-table-header dynamic-grade-table"
                  style={{
                    gridTemplateColumns: `110px repeat(${boulderGradesWithData.length}, 54px)`,
                  }}
                >
                  <span>Style</span>

                  {boulderGradesWithData.map((grade) => (
                    <span key={grade}>G{grade}</span>
                  ))}
                </div>

                {boulderStyles.map((style) => {
                  const rowHasData = boulderGradesWithData.some(
                    (grade) =>
                      getAverageAttemptsByStyleAndGrade(style, grade) !== null
                  );

                  if (!rowHasData) return null;

                  return (
                    <div
                      key={style}
                      className="boulder-table-row dynamic-grade-table"
                      style={{
                        gridTemplateColumns: `110px repeat(${boulderGradesWithData.length}, 54px)`,
                      }}
                    >
                      <span>{style}</span>

                      {boulderGradesWithData.map((grade) => (
                        <span key={`${style}-${grade}`}>
                          {getAverageAttemptsByStyleAndGrade(style, grade) ?? "-"}
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
                xLabel="Datum"
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
                xLabel="Datum"
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