import { useEffect, useMemo, useState } from "react";

import { db } from "../../db/db";

import type {
  BoulderGrade,
  BoulderStyle,
  DiaryEntry,
  DiaryExercise,
  DiaryExerciseSet,
  Exercise,
  ExerciseCategory,
  Superset,
  SupersetExercise,
  TrainingPlan,
  TrainingPlanExercise,
  TrainingPlanSuperset,
} from "../../db/types";

import {
  exportBackupJson,
  formatLastBackupDate,
  shouldShowBackupReminder,
} from "../../utils/backup";

type DraftSetRow = {
  id: string;
  reps: string;
  timeSeconds: string;
  weightKg: string;
};

type DraftSessionExercise = {
  id?: number;
  exerciseId: number;
  setRows: DraftSetRow[];

  boulderStyle: BoulderStyle | "";
  boulderGrade: BoulderGrade | "";
  boulderSessions: string;
  isFlash: boolean;

  supersetInstanceId?: string;
  supersetId?: number;
  supersetName?: string;
  supersetRound?: number;

  notes: string;
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

const boulderGrades: BoulderGrade[] = [
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
];

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function makeId() {
  return `${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function formatSeconds(value: number) {
  const totalSeconds = Math.max(
    0,
    Math.floor(Number(value) || 0)
  );

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours
      .toString()
      .padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes
    .toString()
    .padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function formatExerciseCategory(
  category: ExerciseCategory | undefined
) {
  if (category === "boulder") {
    return "Bouldern";
  }

  if (category === "mobility") {
    return "Beweglichkeit";
  }

  return "Kraft";
}

export default function DiaryPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [diaryExercises, setDiaryExercises] = useState<DiaryExercise[]>([]);

  const [trainingPlans, setTrainingPlans] = useState<TrainingPlan[]>([]);
  const [trainingPlanExercises, setTrainingPlanExercises] = useState<
    TrainingPlanExercise[]
  >([]);

  const [trainingPlanSupersets, setTrainingPlanSupersets] = useState<
    TrainingPlanSuperset[]
  >([]);

  const [supersets, setSupersets] = useState<Superset[]>([]);
  const [supersetExercises, setSupersetExercises] = useState<
    SupersetExercise[]
  >([]);

  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [showSupersetModal, setShowSupersetModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);

  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [showEntryActionMenu, setShowEntryActionMenu] = useState(false);

  const [date, setDate] = useState(todayIsoDate());
  const [title, setTitle] = useState("");
  const [entryNotes, setEntryNotes] = useState("");

  const [selectedExerciseIds, setSelectedExerciseIds] = useState<number[]>([]);

  const [exerciseCategoryFilter, setExerciseCategoryFilter] = useState<
    ExerciseCategory | ""
  >("");

  const [exerciseBodyPartFilter, setExerciseBodyPartFilter] =
    useState("Alle");

  const [draftExercises, setDraftExercises] = useState<
    DraftSessionExercise[]
  >([]);

  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  const [backupReminderVisible, setBackupReminderVisible] = useState(
    shouldShowBackupReminder(7)
  );

  async function loadData() {
    const exerciseData = await db.exercises.toArray();
    const entryData = await db.diaryEntries.toArray();
    const diaryExerciseData = await db.diaryExercises.toArray();

    const planData = await db.trainingPlans.toArray();
    const planExerciseData = await db.trainingPlanExercises.toArray();
    const planSupersetData = await db.trainingPlanSupersets.toArray();

    const supersetData = await db.supersets.toArray();
    const supersetExerciseData = await db.supersetExercises.toArray();

    setExercises(exerciseData);
    setDiaryEntries(entryData);
    setDiaryExercises(diaryExerciseData);

    setTrainingPlans(planData);
    setTrainingPlanExercises(planExerciseData);
    setTrainingPlanSupersets(planSupersetData);

    setSupersets(supersetData);
    setSupersetExercises(supersetExerciseData);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isTimerRunning) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setTimerSeconds((current) => current + 1);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isTimerRunning]);

  const activeExercises = useMemo(() => {
    return exercises
      .filter((exercise) => exercise.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises]);

  const activeSupersets = useMemo(() => {
    return supersets
      .filter((superset) => superset.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [supersets]);

  const activeTrainingPlans = useMemo(() => {
    return trainingPlans
      .filter((plan) => plan.isActive)
      .sort((a, b) => {
        const positionA = a.position ?? Number.MAX_SAFE_INTEGER;
        const positionB = b.position ?? Number.MAX_SAFE_INTEGER;

        if (positionA !== positionB) {
          return positionA - positionB;
        }

        return a.name.localeCompare(b.name);
      });
  }, [trainingPlans]);

  const exerciseMap = useMemo(() => {
    return new Map(
      exercises
        .filter((exercise) => exercise.id !== undefined)
        .map((exercise) => [exercise.id!, exercise])
    );
  }, [exercises]);

  const supersetMap = useMemo(() => {
    return new Map(
      supersets
        .filter((superset) => superset.id !== undefined)
        .map((superset) => [superset.id!, superset])
    );
  }, [supersets]);

  const bodyPartOptions = useMemo(() => {
    if (!exerciseCategoryFilter) {
      return ["Alle"];
    }

    const parts = Array.from(
      new Set(
        activeExercises
          .filter(
            (exercise) =>
              exercise.category === exerciseCategoryFilter
          )
          .map((exercise) => exercise.bodyPart)
      )
    );

    return ["Alle", ...parts];
  }, [activeExercises, exerciseCategoryFilter]);

  const filteredSelectableExercises = useMemo(() => {
    if (!exerciseCategoryFilter) {
      return [];
    }

    return activeExercises.filter((exercise) => {
      const matchesCategory =
        exercise.category === exerciseCategoryFilter;

      const matchesBodyPart =
        exerciseBodyPartFilter === "Alle" ||
        exercise.bodyPart === exerciseBodyPartFilter;

      return matchesCategory && matchesBodyPart;
    });
  }, [
    activeExercises,
    exerciseCategoryFilter,
    exerciseBodyPartFilter,
  ]);

  const sortedEntries = useMemo(() => {
    return [...diaryEntries].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }, [diaryEntries]);

  async function handleDiaryBackupExport() {
    try {
      await exportBackupJson();
      setBackupReminderVisible(false);
      alert("Backup wurde erstellt.");
    } catch (error) {
      console.error(error);
      alert("Backup konnte nicht erstellt werden.");
    }
  }

  function resetAllModals() {
    setShowSessionModal(false);
    setShowPlanModal(false);
    setShowExerciseModal(false);
    setShowSupersetModal(false);
    setShowStatsModal(false);
  }

  function resetSession() {
    setEditingEntryId(null);
    setShowEntryActionMenu(false);

    setDate(todayIsoDate());
    setTitle("");
    setEntryNotes("");

    setSelectedExerciseIds([]);
    setExerciseCategoryFilter("");
    setExerciseBodyPartFilter("Alle");
    setDraftExercises([]);

    setIsTimerRunning(false);
    setTimerSeconds(0);
  }

  function openNewSession() {
    resetSession();
    resetAllModals();
    setShowSessionModal(true);
  }

  function closeAll() {
    resetSession();
    resetAllModals();
  }

  function openPlanSelection() {
    setShowSessionModal(false);
    setShowPlanModal(true);
  }

  function openExerciseSelection() {
    setSelectedExerciseIds([]);
    setExerciseCategoryFilter("");
    setExerciseBodyPartFilter("Alle");

    setShowSessionModal(false);
    setShowSupersetModal(false);
    setShowStatsModal(false);
    setShowExerciseModal(true);
  }

  function openSupersetSelection() {
    setShowSessionModal(false);
    setShowExerciseModal(false);
    setShowStatsModal(false);
    setShowSupersetModal(true);
  }

  function closeExerciseSelection() {
    setShowExerciseModal(false);

    if (draftExercises.length > 0) {
      setShowStatsModal(true);
    } else {
      setShowSessionModal(true);
    }
  }

  function closeSupersetSelection() {
    setShowSupersetModal(false);

    if (draftExercises.length > 0) {
      setShowStatsModal(true);
    } else {
      setShowSessionModal(true);
    }
  }

  function getPlanExerciseNames(planId?: number) {
    if (!planId) {
      return "Keine Einzelübungen";
    }

    const names = trainingPlanExercises
      .filter((item) => item.planId === planId)
      .sort((a, b) => a.position - b.position)
      .map((item) => exerciseMap.get(item.exerciseId)?.name)
      .filter((name): name is string => Boolean(name));

    return names.length > 0
      ? names.join(" · ")
      : "Keine Einzelübungen";
  }

  function getPlanSupersetNames(planId?: number) {
    if (!planId) {
      return "Keine Supersätze";
    }

    const names = trainingPlanSupersets
      .filter((item) => item.planId === planId)
      .sort((a, b) => a.position - b.position)
      .map((item) => supersetMap.get(item.supersetId)?.name)
      .filter((name): name is string => Boolean(name));

    return names.length > 0
      ? names.join(" · ")
      : "Keine Supersätze";
  }

  function getSupersetExerciseNames(supersetId?: number) {
    if (!supersetId) {
      return "Keine Übungen";
    }

    const names = supersetExercises
      .filter((item) => item.supersetId === supersetId)
      .sort((a, b) => a.position - b.position)
      .map((item) => exerciseMap.get(item.exerciseId)?.name)
      .filter((name): name is string => Boolean(name));

    return names.length > 0
      ? names.join(" · ")
      : "Keine Übungen";
  }

  function createSetRows(
    exercise: Exercise,
    setCount?: number,
    reps?: number,
    timeSeconds?: number,
    weightKg?: number
  ): DraftSetRow[] {
    const count = Math.max(
      1,
      Number(setCount || exercise.targetSets || 1)
    );

    return Array.from({ length: count }).map(() => ({
      id: makeId(),

      reps:
        exercise.type === "reps"
          ? String(reps ?? exercise.targetReps ?? "")
          : "",

      timeSeconds:
        exercise.type === "time"
          ? String(
              timeSeconds ??
                exercise.targetTimeSeconds ??
                ""
            )
          : "",

      weightKg:
        weightKg !== undefined
          ? String(weightKg)
          : "",
    }));
  }

  function createDraftFromExercise(
    exercise: Exercise
  ): DraftSessionExercise {
    return {
      exerciseId: exercise.id!,

      setRows:
        exercise.type === "boulder"
          ? []
          : createSetRows(exercise),

      boulderStyle:
        exercise.type === "boulder"
          ? exercise.targetBoulderStyle ?? ""
          : "",

      boulderGrade:
        exercise.type === "boulder"
          ? exercise.targetBoulderGrade ?? ""
          : "",

      boulderSessions:
        exercise.type === "boulder" ? "1" : "",

      isFlash: false,
      notes: "",
    };
  }

  function createSupersetDrafts(
    superset: Superset
  ): DraftSessionExercise[] {
    if (!superset.id) {
      return [];
    }

    const definitionItems = supersetExercises
      .filter((item) => item.supersetId === superset.id)
      .sort((a, b) => a.position - b.position);

    if (definitionItems.length === 0) {
      return [];
    }

    const instanceId = makeId();
    const drafts: DraftSessionExercise[] = [];

    for (
      let round = 1;
      round <= superset.rounds;
      round += 1
    ) {
      definitionItems.forEach((definitionItem) => {
        const exercise = exerciseMap.get(
          definitionItem.exerciseId
        );

        if (!exercise || exercise.type === "boulder") {
          return;
        }

        drafts.push({
          exerciseId: exercise.id!,

          setRows: createSetRows(
            exercise,
            1,
            definitionItem.defaultReps,
            definitionItem.defaultTimeSeconds,
            definitionItem.defaultWeightKg
          ),

          boulderStyle: "",
          boulderGrade: "",
          boulderSessions: "",
          isFlash: false,

          supersetInstanceId: instanceId,
          supersetId: superset.id,
          supersetName: superset.name,
          supersetRound: round,

          notes: definitionItem.notes ?? "",
        });
      });
    }

    return drafts;
  }

  function createFallbackSetRowsFromDiaryExercise(
    item: DiaryExercise,
    exercise: Exercise
  ): DraftSetRow[] {
    const setCount = Math.max(1, Number(item.sets || 1));

    return Array.from({ length: setCount }).map(() => ({
      id: makeId(),

      reps:
        exercise.type === "reps"
          ? item.reps?.toString() ?? ""
          : "",

      timeSeconds:
        exercise.type === "time"
          ? item.timeSeconds?.toString() ?? ""
          : "",

      weightKg: item.weightKg?.toString() ?? "",
    }));
  }

  function convertDiaryExerciseToDraft(
    item: DiaryExercise
  ): DraftSessionExercise {
    const exercise = exerciseMap.get(item.exerciseId);

    const savedSuperset = item.supersetInstanceId
      ? supersets.find((candidate) =>
          supersetExercises.some(
            (definition) =>
              definition.supersetId === candidate.id &&
              definition.exerciseId === item.exerciseId
          )
        )
      : undefined;

    if (!exercise) {
      return {
        id: item.id,
        exerciseId: item.exerciseId,
        setRows: [],

        boulderStyle: item.boulderStyle ?? "",
        boulderGrade: item.boulderGrade ?? "",
        boulderSessions:
          item.boulderSessions?.toString() ?? "1",
        isFlash: item.isFlash ?? false,

        supersetInstanceId: item.supersetInstanceId,
        supersetId: savedSuperset?.id,
        supersetName: savedSuperset?.name,
        supersetRound: item.supersetRound,

        notes: item.notes ?? "",
      };
    }

    const rows =
      item.setRows && item.setRows.length > 0
        ? item.setRows.map((row) => ({
            id: row.id || makeId(),
            reps: row.reps?.toString() ?? "",
            timeSeconds:
              row.timeSeconds?.toString() ?? "",
            weightKg:
              row.weightKg?.toString() ?? "",
          }))
        : exercise.type === "boulder"
        ? []
        : createFallbackSetRowsFromDiaryExercise(
            item,
            exercise
          );

    return {
      id: item.id,
      exerciseId: item.exerciseId,
      setRows: rows,

      boulderStyle: item.boulderStyle ?? "",
      boulderGrade: item.boulderGrade ?? "",
      boulderSessions:
        item.boulderSessions?.toString() ?? "1",
      isFlash: item.isFlash ?? false,

      supersetInstanceId: item.supersetInstanceId,
      supersetId: savedSuperset?.id,
      supersetName: savedSuperset?.name,
      supersetRound: item.supersetRound,

      notes: item.notes ?? "",
    };
  }

  function loadSupersetIntoSession(
    superset: Superset
  ) {
    const drafts = createSupersetDrafts(superset);

    if (drafts.length === 0) {
      alert(
        "Dieser Supersatz enthält keine verwendbaren Übungen."
      );

      return;
    }

    setDraftExercises((current) => [
      ...current,
      ...drafts,
    ]);

    if (!title.trim()) {
      setTitle(superset.name);
    }

    setShowSupersetModal(false);
    setShowStatsModal(true);
  }

  function loadPlanIntoStats(plan: TrainingPlan) {
    if (!plan.id) {
      return;
    }

    const planItems = trainingPlanExercises
      .filter((item) => item.planId === plan.id)
      .sort((a, b) => a.position - b.position);

    const planSupersetItems = trainingPlanSupersets
      .filter((item) => item.planId === plan.id)
      .sort((a, b) => a.position - b.position);

    if (
      planItems.length === 0 &&
      planSupersetItems.length === 0
    ) {
      alert(
        "Dieser Trainingsplan enthält noch keine Übungen oder Supersätze."
      );

      return;
    }

    const normalDrafts = planItems
      .map((item): DraftSessionExercise | null => {
        const exercise = exerciseMap.get(item.exerciseId);

        if (!exercise) {
          return null;
        }

        return {
          exerciseId: item.exerciseId,

          setRows:
            exercise.type === "boulder"
              ? []
              : createSetRows(
                  exercise,
                  item.defaultSets,
                  item.defaultReps,
                  item.defaultTimeSeconds,
                  item.defaultWeightKg
                ),

          boulderStyle:
            exercise.type === "boulder"
              ? exercise.targetBoulderStyle ?? ""
              : "",

          boulderGrade:
            exercise.type === "boulder"
              ? exercise.targetBoulderGrade ?? ""
              : "",

          boulderSessions:
            exercise.type === "boulder" ? "1" : "",

          isFlash: false,
          notes: item.notes ?? "",
        };
      })
      .filter(
        (item): item is DraftSessionExercise =>
          item !== null
      );

    const supersetDrafts = planSupersetItems.flatMap(
      (item) => {
        const superset = supersetMap.get(item.supersetId);

        if (!superset) {
          return [];
        }

        return createSupersetDrafts(superset);
      }
    );

    setDraftExercises([
      ...normalDrafts,
      ...supersetDrafts,
    ]);

    if (!title.trim()) {
      setTitle(plan.name);
    }

    setShowPlanModal(false);
    setShowStatsModal(true);
  }

  function toggleExerciseSelection(
    exerciseId?: number
  ) {
    if (!exerciseId) {
      return;
    }

    setSelectedExerciseIds((current) => {
      if (current.includes(exerciseId)) {
        return current.filter(
          (id) => id !== exerciseId
        );
      }

      return [...current, exerciseId];
    });
  }

  function continueFromExerciseSelection() {
    if (selectedExerciseIds.length === 0) {
      alert(
        "Bitte mindestens eine Übung auswählen."
      );

      return;
    }

    const newDraftItems = selectedExerciseIds
      .map((exerciseId) => {
        const exercise = exerciseMap.get(exerciseId);

        return exercise
          ? createDraftFromExercise(exercise)
          : null;
      })
      .filter(
        (item): item is DraftSessionExercise =>
          item !== null
      );

    setDraftExercises((current) => [
      ...current,
      ...newDraftItems,
    ]);

    setSelectedExerciseIds([]);
    setShowExerciseModal(false);
    setShowStatsModal(true);
  }

  function updateSetRow(
    exerciseIndex: number,
    setIndex: number,
    field: keyof DraftSetRow,
    value: string
  ) {
    setDraftExercises((current) =>
      current.map(
        (
          exerciseItem,
          currentExerciseIndex
        ) => {
          if (
            currentExerciseIndex !== exerciseIndex
          ) {
            return exerciseItem;
          }

          return {
            ...exerciseItem,

            setRows: exerciseItem.setRows.map(
              (setRow, currentSetIndex) => {
                if (currentSetIndex !== setIndex) {
                  return setRow;
                }

                return {
                  ...setRow,
                  [field]:value,
                };
              }
            ),
          };
        }
      )
    );
  }

  function updateDraftExercise(
    exerciseIndex: number,
    updates: Partial<DraftSessionExercise>
  ) {
    setDraftExercises((current) =>
      current.map(
        (
          exerciseItem,
          currentExerciseIndex
        ) =>
          currentExerciseIndex === exerciseIndex
            ? {
                ...exerciseItem,
                ...updates,
              }
            : exerciseItem
      )
    );
  }

  function updateExerciseNotes(
    exerciseIndex: number,
    value: string
  ) {
    updateDraftExercise(exerciseIndex, {
      notes: value,
    });
  }

  function addSetRow(exerciseIndex: number) {
    setDraftExercises((current) =>
      current.map(
        (
          exerciseItem,
          currentExerciseIndex
        ) => {
          if (
            currentExerciseIndex !== exerciseIndex
          ) {
            return exerciseItem;
          }

          const lastRow =
            exerciseItem.setRows[
              exerciseItem.setRows.length - 1
            ];

          return {
            ...exerciseItem,

            setRows: [
              ...exerciseItem.setRows,
              {
                id: makeId(),
                reps: lastRow?.reps ?? "",
                timeSeconds:
                  lastRow?.timeSeconds ?? "",
                weightKg:
                  lastRow?.weightKg ?? "",
              },
            ],
          };
        }
      )
    );
  }

  function duplicateBoulder(
    exerciseIndex: number
  ) {
    setDraftExercises((current) => {
      const source = current[exerciseIndex];

      if (!source) {
        return current;
      }

      const exercise = exerciseMap.get(
        source.exerciseId
      );

      if (exercise?.type !== "boulder") {
        return current;
      }

      const duplicate: DraftSessionExercise = {
        exerciseId: source.exerciseId,
        setRows: [],

        boulderStyle: source.boulderStyle,
        boulderGrade: source.boulderGrade,
        boulderSessions: "1",
        isFlash: false,

        notes: source.notes,
      };

      return [
        ...current.slice(0, exerciseIndex + 1),
        duplicate,
        ...current.slice(exerciseIndex + 1),
      ];
    });
  }

  function removeSetRow(
    exerciseIndex: number,
    setIndex: number
  ) {
    setDraftExercises((current) =>
      current.map(
        (
          exerciseItem,
          currentExerciseIndex
        ) => {
          if (
            currentExerciseIndex !== exerciseIndex
          ) {
            return exerciseItem;
          }

          const nextRows =
            exerciseItem.setRows.filter(
              (_, currentSetIndex) =>
                currentSetIndex !== setIndex
            );

          return {
            ...exerciseItem,

            setRows:
              nextRows.length > 0
                ? nextRows
                : [
                    {
                      id: makeId(),
                      reps: "",
                      timeSeconds: "",
                      weightKg: "",
                    },
                  ],
          };
        }
      )
    );
  }

  function removeDraftExercise(
    exerciseIndex: number
  ) {
    setDraftExercises((current) =>
      current.filter(
        (_, currentIndex) =>
          currentIndex !== exerciseIndex
      )
    );
  }

  function removeSupersetInstance(
    instanceId: string
  ) {
    const confirmed = window.confirm(
      "Diesen vollständigen Supersatz aus der Session entfernen?"
    );

    if (!confirmed) {
      return;
    }

    setDraftExercises((current) =>
      current.filter(
        (item) =>
          item.supersetInstanceId !== instanceId
      )
    );
  }

  function startTimer() {
    setIsTimerRunning(true);
  }

  function stopTimer() {
    setIsTimerRunning(false);
  }

  function resetTimer() {
    setIsTimerRunning(false);
    setTimerSeconds(0);
  }

  function getLastStatsForExercise(
    exerciseId: number
  ) {
    const candidates = diaryExercises
      .filter((item) => {
        if (item.exerciseId !== exerciseId) {
          return false;
        }

        if (
          editingEntryId &&
          item.diaryEntryId === editingEntryId
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );

    return candidates[0] ?? null;
  }

  function validateDraft() {
    if (draftExercises.length === 0) {
      alert(
        "Bitte mindestens eine Übung hinzufügen."
      );

      return false;
    }

    for (const draftExercise of draftExercises) {
      const exercise = exerciseMap.get(
        draftExercise.exerciseId
      );

      if (!exercise) {
        alert("Eine Übung wurde nicht gefunden.");
        return false;
      }

      if (exercise.type === "boulder") {
        const parsedSessions = Number(
          draftExercise.boulderSessions
        );

        if (
          !Number.isInteger(parsedSessions) ||
          parsedSessions < 1
        ) {
          alert(
            `Bitte für "${exercise.name}" eine gültige Anzahl Trainingstage ab 1 eintragen.`
          );

          return false;
        }

        continue;
      }

      if (draftExercise.setRows.length === 0) {
        alert(
          `Bitte mindestens einen Satz für "${exercise.name}" eintragen.`
        );

        return false;
      }

      for (const [
        index,
        setRow,
      ] of draftExercise.setRows.entries()) {
        if (
          exercise.type === "reps" &&
          !setRow.reps.trim()
        ) {
          alert(
            `Bitte Wiederholungen für "${exercise.name}", Satz ${
              index + 1
            } eintragen.`
          );

          return false;
        }

        if (
          exercise.type === "time" &&
          !setRow.timeSeconds.trim()
        ) {
          alert(
            `Bitte Zeit für "${exercise.name}", Satz ${
              index + 1
            } eintragen.`
          );

          return false;
        }
      }
    }

    return true;
  }

  function toSavedSetRows(
    item: DraftSessionExercise,
    exercise?: Exercise
  ) {
    const rows: DiaryExerciseSet[] =
      item.setRows.map((row) => ({
        id: row.id,

        reps:
          exercise?.type === "reps" &&
          row.reps
            ? Number(row.reps)
            : undefined,

        timeSeconds:
          exercise?.type === "time" &&
          row.timeSeconds
            ? Number(row.timeSeconds)
            : undefined,

        weightKg: row.weightKg
          ? Number(row.weightKg)
          : 0,
      }));

    return rows;
  }

  function buildDiaryExercisePayload(
    entryId: number,
    item: DraftSessionExercise,
    now: string
  ) {
    const exercise = exerciseMap.get(
      item.exerciseId
    );

    const savedRows = toSavedSetRows(
      item,
      exercise
    );

    if (exercise?.type === "boulder") {
      return {
        diaryEntryId: entryId,
        exerciseId: item.exerciseId,

        boulderStyle:
          item.boulderStyle || undefined,

        boulderGrade:
          item.boulderGrade || undefined,

        boulderSessions:
          item.boulderSessions
            ? Number(item.boulderSessions)
            : 1,

        isFlash: item.isFlash,

        notes:
          item.notes.trim() || undefined,

        createdAt: now,
        updatedAt: now,
      };
    }

    return {
      diaryEntryId: entryId,
      exerciseId: item.exerciseId,

      sets: savedRows.length,

      reps:
        exercise?.type === "reps"
          ? savedRows[0]?.reps
          : undefined,

      timeSeconds:
        exercise?.type === "time"
          ? savedRows[0]?.timeSeconds
          : undefined,

      weightKg:
        savedRows[0]?.weightKg ?? 0,

      setRows: savedRows,

      supersetInstanceId:
        item.supersetInstanceId,

      supersetRound:
        item.supersetRound,

      notes:
        item.notes.trim() || undefined,

      createdAt: now,
      updatedAt: now,
    };
  }

  async function saveSession() {
    if (!validateDraft()) {
      return;
    }

    const now = new Date().toISOString();

    if (editingEntryId) {
      const entryId = editingEntryId;

      await db.transaction(
        "rw",
        db.diaryEntries,
        db.diaryExercises,
        async () => {
          await db.diaryEntries.update(
            entryId,
            {
              date,
              title:
                title.trim() || "Session",
              notes:
                entryNotes.trim() ||
                undefined,
              updatedAt: now,
            }
          );

          await db.diaryExercises
            .where("diaryEntryId")
            .equals(entryId)
            .delete();

          await db.diaryExercises.bulkAdd(
            draftExercises.map((item) =>
              buildDiaryExercisePayload(
                entryId,
                item,
                now
              )
            )
          );
        }
      );
    } else {
      const entryId =
        await db.diaryEntries.add({
          date,
          title:
            title.trim() || "Session",
          notes:
            entryNotes.trim() || undefined,
          createdAt: now,
          updatedAt: now,
        });

      await db.diaryExercises.bulkAdd(
        draftExercises.map((item) =>
          buildDiaryExercisePayload(
            entryId,
            item,
            now
          )
        )
      );
    }

    resetSession();
    resetAllModals();
    await loadData();
  }

  function editSession(entry: DiaryEntry) {
    if (!entry.id) {
      return;
    }

    const items = diaryExercises
      .filter(
        (item) =>
          item.diaryEntryId === entry.id
      )
      .map((item) =>
        convertDiaryExerciseToDraft(item)
      );

    setEditingEntryId(entry.id);
    setShowEntryActionMenu(false);

    setDate(entry.date);
    setTitle(entry.title ?? "");
    setEntryNotes(entry.notes ?? "");

    setDraftExercises(items);
    setSelectedExerciseIds([]);

    setIsTimerRunning(false);
    setTimerSeconds(0);

    resetAllModals();
    setShowStatsModal(true);
  }

  async function deleteCurrentEditingSession() {
    if (!editingEntryId) {
      return;
    }

    const confirmed = window.confirm(
      "Diese Session wirklich löschen?"
    );

    if (!confirmed) {
      return;
    }

    await db.transaction(
      "rw",
      db.diaryEntries,
      db.diaryExercises,
      async () => {
        await db.diaryExercises
          .where("diaryEntryId")
          .equals(editingEntryId)
          .delete();

        await db.diaryEntries.delete(
          editingEntryId
        );
      }
    );

    resetSession();
    resetAllModals();
    await loadData();
  }

  function getExercisesForEntry(
    entryId?: number
  ) {
    if (!entryId) {
      return [];
    }

    return diaryExercises.filter(
      (item) =>
        item.diaryEntryId === entryId
    );
  }

  const renderedDraftItems = useMemo(() => {
    const result: Array<
      | {
          type: "single";
          item: DraftSessionExercise;
          originalIndex: number;
        }
      | {
          type: "superset";
          instanceId: string;
          name: string;
          items: Array<{
            item: DraftSessionExercise;
            originalIndex: number;
          }>;
        }
    > = [];

    const handledInstances = new Set<string>();

    draftExercises.forEach((item, index) => {
      const instanceId =
        item.supersetInstanceId;

      if (!instanceId) {
        result.push({
          type: "single",
          item,
          originalIndex: index,
        });

        return;
      }

      if (handledInstances.has(instanceId)) {
        return;
      }

      handledInstances.add(instanceId);

      const groupItems = draftExercises
        .map((candidate, candidateIndex) => ({
          item: candidate,
          originalIndex: candidateIndex,
        }))
        .filter(
          (candidate) =>
            candidate.item
              .supersetInstanceId === instanceId
        );

      result.push({
        type: "superset",
        instanceId,
        name:
          item.supersetName ?? "Supersatz",
        items: groupItems,
      });
    });

    return result;
  }, [draftExercises]);

  return (
    <section className="card">
      <div className="page-header">
        <div>
          <h2>Tagebuch</h2>
          <p>
            Sessions erfassen und nach Datum
            anzeigen.
          </p>
        </div>

        <button
          className="primary-action-button"
          onClick={openNewSession}
        >
          Session hinzufügen
        </button>
      </div>

      {backupReminderVisible && (
        <div className="backup-banner">
          <div>
            <h3>Backup empfohlen</h3>

            <p>
              Letztes Backup:{" "}
              {formatLastBackupDate()}
            </p>

            <p>
              Deine Daten liegen lokal auf
              diesem Gerät. Erstelle
              regelmäßig ein Backup.
            </p>
          </div>

          <button
            className="primary-action-button"
            onClick={
              handleDiaryBackupExport
            }
          >
            Backup jetzt erstellen
          </button>
        </div>
      )}

      {showSessionModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Neue Session</h3>

                <p>
                  Datum und Namen festlegen.
                </p>
              </div>

              <button
                className="secondary-button small-button"
                onClick={closeAll}
              >
                Schließen
              </button>
            </div>

            <div className="form-block">
              <label className="field-label">
                Datum
              </label>

              <input
                type="date"
                value={date}
                onChange={(event) =>
                  setDate(event.target.value)
                }
              />

              <input
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder="Session-Name"
              />

              <textarea
                value={entryNotes}
                onChange={(event) =>
                  setEntryNotes(
                    event.target.value
                  )
                }
                placeholder="Notiz optional"
                rows={2}
              />

              <button
                onClick={openPlanSelection}
              >
                Trainingsplan laden
              </button>

              <button
                className="secondary-button"
                onClick={
                  openExerciseSelection
                }
              >
                Einzelübungen hinzufügen
              </button>

              <button
                className="secondary-button"
                onClick={
                  openSupersetSelection
                }
              >
                Supersatz hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      {showPlanModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>
                  Trainingsplan laden
                </h3>

                <p>
                  Einzelübungen und
                  Supersätze werden geladen.
                </p>
              </div>

              <button
                className="secondary-button small-button"
                onClick={() => {
                  setShowPlanModal(false);
                  setShowSessionModal(true);
                }}
              >
                Zurück
              </button>
            </div>

            <div className="list">
              {activeTrainingPlans.length ===
                0 && (
                <p>
                  Noch keine aktiven
                  Trainingspläne vorhanden.
                </p>
              )}

              {activeTrainingPlans.map(
                (plan) => (
                  <div
                    key={plan.id}
                    className="list-item"
                  >
                    <h3>{plan.name}</h3>

                    {plan.description && (
                      <p>
                        {plan.description}
                      </p>
                    )}

                    <p>
                      Einzelübungen:{" "}
                      <strong>
                        {getPlanExerciseNames(
                          plan.id
                        )}
                      </strong>
                    </p>

                    <p>
                      Supersätze:{" "}
                      <strong>
                        {getPlanSupersetNames(
                          plan.id
                        )}
                      </strong>
                    </p>

                    <button
                      onClick={() =>
                        loadPlanIntoStats(
                          plan
                        )
                      }
                    >
                      Plan auswählen
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {showSupersetModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>
                  Supersatz hinzufügen
                </h3>

                <p>
                  Wähle einen aktiven
                  Supersatz aus.
                </p>
              </div>

              <button
                className="secondary-button small-button"
                onClick={
                  closeSupersetSelection
                }
              >
                Zurück
              </button>
            </div>

            <div className="list">
              {activeSupersets.length ===
                0 && (
                <p>
                  Noch keine aktiven
                  Supersätze vorhanden.
                </p>
              )}

              {activeSupersets.map(
                (superset) => (
                  <div
                    key={superset.id}
                    className="list-item"
                  >
                    <h3>
                      {superset.name}
                    </h3>

                    <p>
                      {superset.rounds}{" "}
                      {superset.rounds === 1
                        ? "Durchgang"
                        : "Durchgänge"}
                    </p>

                    <p>
                      Übungen:{" "}
                      <strong>
                        {getSupersetExerciseNames(
                          superset.id
                        )}
                      </strong>
                    </p>

                    <button
                      onClick={() =>
                        loadSupersetIntoSession(
                          superset
                        )
                      }
                    >
                      Supersatz auswählen
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {showExerciseModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>
                  Übungen hinzufügen
                </h3>

                <p>
                  Zuerst Kategorie, dann
                  Übung auswählen.
                </p>
              </div>

              <button
                className="secondary-button small-button"
                onClick={
                  closeExerciseSelection
                }
              >
                Zurück
              </button>
            </div>

            <div className="form-block compact">
              <label className="field-label">
                Kategorie
              </label>

              <select
                value={
                  exerciseCategoryFilter
                }
                onChange={(event) => {
                  setExerciseCategoryFilter(
                    event.target.value as
                      | ExerciseCategory
                      | ""
                  );

                  setExerciseBodyPartFilter(
                    "Alle"
                  );

                  setSelectedExerciseIds(
                    []
                  );
                }}
              >
                <option value="">
                  Kategorie auswählen
                </option>

                <option value="strength">
                  Kraft
                </option>

                <option value="mobility">
                  Beweglichkeit
                </option>

                <option value="boulder">
                  Bouldern
                </option>
              </select>

              {exerciseCategoryFilter && (
                <select
                  value={
                    exerciseBodyPartFilter
                  }
                  onChange={(event) =>
                    setExerciseBodyPartFilter(
                      event.target.value
                    )
                  }
                >
                  {bodyPartOptions.map(
                    (bodyPart) => (
                      <option
                        key={bodyPart}
                        value={bodyPart}
                      >
                        {bodyPart}
                      </option>
                    )
                  )}
                </select>
              )}
            </div>

            <div className="list">
              {filteredSelectableExercises.map(
                (exercise) => (
                  <div
                    key={exercise.id}
                    className="list-item"
                  >
                    <div className="list-item-header">
                      <div>
                        <h3>
                          {exercise.name}
                        </h3>

                        <p>
                          {formatExerciseCategory(
                            exercise.category
                          )}{" "}
                          ·{" "}
                          {exercise.bodyPart}
                        </p>
                      </div>

                      <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={
                          exercise.id !==
                            undefined &&
                          selectedExerciseIds.includes(
                            exercise.id
                          )
                        }
                        onChange={() =>
                          toggleExerciseSelection(
                            exercise.id
                          )
                        }
                      />
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="session-action-row">
              <button
                onClick={
                  continueFromExerciseSelection
                }
                disabled={
                  selectedExerciseIds.length ===
                  0
                }
              >
                Weiter
              </button>

              <button
                className="secondary-button"
                onClick={
                  closeExerciseSelection
                }
              >
                Zurück
              </button>
            </div>
          </div>
        </div>
      )}

      {showStatsModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>
                  {editingEntryId
                    ? "Session bearbeiten"
                    : "Session erfassen"}
                </h3>

                <p>
                  Einzelübungen und
                  Supersätze bearbeiten.
                </p>
              </div>

              <div className="plan-menu-wrapper">
                {editingEntryId ? (
                  <>
                    <button
                      className="icon-button"
                      onClick={() =>
                        setShowEntryActionMenu(
                          (current) =>
                            !current
                        )
                      }
                    >
                      ⋮
                    </button>

                    {showEntryActionMenu && (
                      <div className="plan-options-menu">
                        <button
                          className="menu-button danger-menu-button"
                          onClick={
                            deleteCurrentEditingSession
                          }
                        >
                          Löschen
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    className="secondary-button small-button"
                    onClick={closeAll}
                  >
                    Schließen
                  </button>
                )}
              </div>
            </div>

            <div className="session-sticky-timer">
              <div className="session-timer-display">
                <span>Session-Zeit</span>

                <strong>
                  {formatSeconds(
                    timerSeconds
                  )}
                </strong>
              </div>

              <div className="session-timer-actions">
                {!isTimerRunning ? (
                  <button
                    onClick={startTimer}
                  >
                    {timerSeconds > 0
                      ? "Weiter"
                      : "Start"}
                  </button>
                ) : (
                  <button
                    className="secondary-button"
                    onClick={stopTimer}
                  >
                    Stop
                  </button>
                )}

                <button
                  className="secondary-button"
                  onClick={resetTimer}
                  disabled={
                    timerSeconds === 0
                  }
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="form-block">
              <input
                type="date"
                value={date}
                onChange={(event) =>
                  setDate(event.target.value)
                }
              />

              <input
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder="Session-Name"
              />

              <textarea
                value={entryNotes}
                onChange={(event) =>
                  setEntryNotes(
                    event.target.value
                  )
                }
                placeholder="Notiz optional"
                rows={2}
              />
            </div>

            <div className="session-action-row">
              <button
                className="secondary-button"
                onClick={
                  openExerciseSelection
                }
              >
                Einzelübung hinzufügen
              </button>

              <button
                className="secondary-button"
                onClick={
                  openSupersetSelection
                }
              >
                Supersatz hinzufügen
              </button>
            </div>

            <div className="list">
              {renderedDraftItems.map(
                (renderItem, renderIndex) => {
                  if (
                    renderItem.type ===
                    "superset"
                  ) {
                    const rounds = Array.from(
                      new Set(
                        renderItem.items.map(
                          ({ item }) =>
                            item.supersetRound ??
                            1
                        )
                      )
                    ).sort((a, b) => a - b);

                    return (
                      <div
                        key={
                          renderItem.instanceId
                        }
                        className="sub-card superset-session-card"
                      >
                        <div className="list-item-header">
                          <div>
                            <h3>
                              Supersatz:{" "}
                              {renderItem.name}
                            </h3>

                            <p>
                              {rounds.length}{" "}
                              Durchgänge
                            </p>
                          </div>

                          <button
                            className="danger-button small-button"
                            onClick={() =>
                              removeSupersetInstance(
                                renderItem.instanceId
                              )
                            }
                          >
                            Entfernen
                          </button>
                        </div>

                        {rounds.map(
                          (round) => (
                            <div
                              key={round}
                              className="superset-round"
                            >
                              <h3>
                                Durchgang{" "}
                                {round}
                              </h3>

                              {renderItem.items
                                .filter(
                                  ({ item }) =>
                                    (item.supersetRound ??
                                      1) ===
                                    round
                                )
                                .map(
                                  ({
                                    item,
                                    originalIndex,
                                  }) => (
                                    <SessionExerciseEditor
                                      key={`${renderItem.instanceId}-${round}-${item.exerciseId}`}
                                      draftExercise={
                                        item
                                      }
                                      exerciseIndex={
                                        originalIndex
                                      }
                                      exercise={exerciseMap.get(
                                        item.exerciseId
                                      )}
                                      previousStats={getLastStatsForExercise(
                                        item.exerciseId
                                      )}
                                      updateSetRow={
                                        updateSetRow
                                      }
                                      updateDraftExercise={
                                        updateDraftExercise
                                      }
                                      updateExerciseNotes={
                                        updateExerciseNotes
                                      }
                                      addSetRow={
                                        addSetRow
                                      }
                                      removeSetRow={
                                        removeSetRow
                                      }
                                      removeDraftExercise={
                                        removeDraftExercise
                                      }
                                      duplicateBoulder={
                                        duplicateBoulder
                                      }
                                      compactSuperset
                                    />
                                  )
                                )}
                            </div>
                          )
                        )}
                      </div>
                    );
                  }

                  return (
                    <SessionExerciseEditor
                      key={`single-${renderIndex}-${renderItem.item.exerciseId}`}
                      draftExercise={
                        renderItem.item
                      }
                      exerciseIndex={
                        renderItem.originalIndex
                      }
                      exercise={exerciseMap.get(
                        renderItem.item
                          .exerciseId
                      )}
                      previousStats={getLastStatsForExercise(
                        renderItem.item
                          .exerciseId
                      )}
                      updateSetRow={
                        updateSetRow
                      }
                      updateDraftExercise={
                        updateDraftExercise
                      }
                      updateExerciseNotes={
                        updateExerciseNotes
                      }
                      addSetRow={addSetRow}
                      removeSetRow={
                        removeSetRow
                      }
                      removeDraftExercise={
                        removeDraftExercise
                      }
                      duplicateBoulder={
                        duplicateBoulder
                      }
                    />
                  );
                }
              )}
            </div>

            <div className="session-action-row">
              <button onClick={saveSession}>
                {editingEntryId
                  ? "Session speichern"
                  : "Session anlegen"}
              </button>

              <button
                className="secondary-button"
                onClick={closeAll}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="list">
        {sortedEntries.length === 0 && (
          <p>
            Noch keine Sessions vorhanden.
          </p>
        )}

        {sortedEntries.map((entry) => {
          const items =
            getExercisesForEntry(entry.id);

          const boulderGroups =
            groupBouldersByGrade(
              items,
              exerciseMap
            );

          const nonBoulderItems =
            items.filter(
              (item) =>
                exerciseMap.get(
                  item.exerciseId
                )?.type !== "boulder"
            );

          const supersetInstanceCount =
            new Set(
              nonBoulderItems
                .map(
                  (item) =>
                    item.supersetInstanceId
                )
                .filter(
                  (
                    value
                  ): value is string =>
                    Boolean(value)
                )
            ).size;

          const individualItems =
            nonBoulderItems.filter(
              (item) =>
                !item.supersetInstanceId
            );

          return (
            <article
              key={entry.id}
              className="list-item session-overview-card"
              onClick={() =>
                editSession(entry)
              }
            >
              <h3>
                {entry.title || "Session"}
              </h3>

              <p>{entry.date}</p>

              {entry.notes && (
                <p>
                  Notiz: {entry.notes}
                </p>
              )}

              <div className="session-exercise-summary">
                {boulderGroups.map(
                  (group) => (
                    <div
                      key={group.label}
                      className="session-exercise-line"
                    >
                      {group.count}×{" "}
                      {group.label} Boulder
                    </div>
                  )
                )}

                {supersetInstanceCount >
                  0 && (
                  <div className="session-exercise-line">
                    {supersetInstanceCount}×{" "}
                    Supersatz
                  </div>
                )}

                {individualItems.map(
                  (item) => (
                    <div
                      key={item.id}
                      className="session-exercise-line"
                    >
                      {formatDiaryExerciseLine(
                        item,
                        exerciseMap.get(
                          item.exerciseId
                        )
                      )}
                    </div>
                  )
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

type SessionExerciseEditorProps = {
  draftExercise: DraftSessionExercise;
  exerciseIndex: number;
  exercise?: Exercise;
  previousStats: DiaryExercise | null;

  updateSetRow: (
    exerciseIndex: number,
    setIndex: number,
    field: keyof DraftSetRow,
    value: string
  ) => void;

  updateDraftExercise: (
    exerciseIndex: number,
    updates: Partial<DraftSessionExercise>
  ) => void;

  updateExerciseNotes: (
    exerciseIndex: number,
    value: string
  ) => void;

  addSetRow: (
    exerciseIndex: number
  ) => void;

  removeSetRow: (
    exerciseIndex: number,
    setIndex: number
  ) => void;

  removeDraftExercise: (
    exerciseIndex: number
  ) => void;

  duplicateBoulder: (
    exerciseIndex: number
  ) => void;

  compactSuperset?: boolean;
};

function SessionExerciseEditor({
  draftExercise,
  exerciseIndex,
  exercise,
  previousStats,
  updateSetRow,
  updateDraftExercise,
  updateExerciseNotes,
  addSetRow,
  removeSetRow,
  removeDraftExercise,
  duplicateBoulder,
  compactSuperset = false,
}: SessionExerciseEditorProps) {
  const isBoulderExercise =
    exercise?.type === "boulder";

  const wrapperClass = compactSuperset
    ? "list-item superset-exercise-item"
    : "list-item";

  return (
    <div className={wrapperClass}>
      <div className="list-item-header">
        <div>
          <h3>
            {exercise?.name ??
              "Unbekannte Übung"}
          </h3>

          <p>
            {exercise?.type === "reps"
              ? "Wiederholungen"
              : exercise?.type === "time"
              ? "Zeit"
              : "Bouldern"}
          </p>
        </div>

        {!compactSuperset && (
          <button
            className="danger-button small-button"
            onClick={() =>
              removeDraftExercise(
                exerciseIndex
              )
            }
          >
            Entfernen
          </button>
        )}
      </div>

      {previousStats && (
        <div className="last-stats-box">
          <strong>
            Letzte Session:
          </strong>

          {formatLastStats(
            previousStats,
            exercise
          )}
        </div>
      )}

      {isBoulderExercise && (
        <div className="form-block compact">
          <select
            value={
              draftExercise.boulderStyle
            }
            onChange={(event) =>
              updateDraftExercise(
                exerciseIndex,
                {
                  boulderStyle:
                    event.target.value as
                      | BoulderStyle
                      | "",
                }
              )
            }
          >
            <option value="">
              Kein Style ausgewählt
            </option>

            {boulderStyles.map(
              (style) => (
                <option
                  key={style}
                  value={style}
                >
                  {style}
                </option>
              )
            )}
          </select>

          <select
            value={
              draftExercise.boulderGrade
            }
            onChange={(event) =>
              updateDraftExercise(
                exerciseIndex,
                {
                  boulderGrade:
                    event.target.value
                      ? (Number(
                          event.target.value
                        ) as BoulderGrade)
                      : "",
                }
              )
            }
          >
            <option value="">
              Kein Grad ausgewählt
            </option>

            {boulderGrades.map(
              (grade) => (
                <option
                  key={grade}
                  value={grade}
                >
                  Grad {grade}
                </option>
              )
            )}
          </select>

          <div className="input-with-unit">
            <input
              type="number"
              min="1"
              step="1"
              value={
                draftExercise.boulderSessions
              }
              onChange={(event) =>
                updateDraftExercise(
                  exerciseIndex,
                  {
                    boulderSessions:
                      event.target.value,
                  }
                )
              }
            />

            <span>Trainingstage</span>
          </div>

          <label className="inline-toggle">
            <input
              type="checkbox"
              checked={
                draftExercise.isFlash
              }
              onChange={(event) =>
                updateDraftExercise(
                  exerciseIndex,
                  {
                    isFlash:
                      event.target.checked,
                  }
                )
              }
            />

            Boulder geflasht
          </label>

          <button
            className="secondary-button"
            onClick={() =>
              duplicateBoulder(
                exerciseIndex
              )
            }
          >
            + Satz hinzufügen
          </button>
        </div>
      )}

      {!isBoulderExercise && (
        <>
          <div className="set-table">
            {draftExercise.setRows.map(
              (setRow, setIndex) => (
                <div
                  key={setRow.id}
                  className="set-row"
                >
                  <span className="set-number">
                    Satz {setIndex + 1}
                  </span>

                  <div className="input-with-unit">
                    <input
                      type="number"
                      value={
                        setRow.weightKg
                      }
                      onChange={(event) =>
                        updateSetRow(
                          exerciseIndex,
                          setIndex,
                          "weightKg",
                          event.target.value
                        )
                      }
                    />

                    <span>kg</span>
                  </div>

                  {exercise?.type ===
                    "reps" && (
                    <div className="input-with-unit">
                      <input
                        type="number"
                        min="0"
                        value={setRow.reps}
                        onChange={(event) =>
                          updateSetRow(
                            exerciseIndex,
                            setIndex,
                            "reps",
                            event.target
                              .value
                          )
                        }
                      />

                      <span>Wdh.</span>
                    </div>
                  )}

                  {exercise?.type ===
                    "time" && (
                    <div className="input-with-unit">
                      <input
                        type="number"
                        min="0"
                        value={
                          setRow.timeSeconds
                        }
                        onChange={(event) =>
                          updateSetRow(
                            exerciseIndex,
                            setIndex,
                            "timeSeconds",
                            event.target
                              .value
                          )
                        }
                      />

                      <span>sek</span>
                    </div>
                  )}

                  {!compactSuperset && (
                    <button
                      className="danger-button small-button"
                      onClick={() =>
                        removeSetRow(
                          exerciseIndex,
                          setIndex
                        )
                      }
                    >
                      −
                    </button>
                  )}
                </div>
              )
            )}
          </div>

          {!compactSuperset && (
            <button
              className="secondary-button"
              onClick={() =>
                addSetRow(exerciseIndex)
              }
            >
              + Satz hinzufügen
            </button>
          )}
        </>
      )}

      <textarea
        value={draftExercise.notes}
        onChange={(event) =>
          updateExerciseNotes(
            exerciseIndex,
            event.target.value
          )
        }
        placeholder="Notiz optional"
        rows={2}
      />
    </div>
  );
}

function groupBouldersByGrade(
  items: DiaryExercise[],
  exerciseMap: Map<number, Exercise>
) {
  const grouped = new Map<string, number>();

  items.forEach((item) => {
    const exercise = exerciseMap.get(
      item.exerciseId
    );

    if (exercise?.type !== "boulder") {
      return;
    }

    const key = item.boulderGrade
      ? `Grad ${item.boulderGrade}`
      : "ohne Grad";

    grouped.set(
      key,
      (grouped.get(key) ?? 0) + 1
    );
  });

  return Array.from(grouped.entries()).map(
    ([label, count]) => ({
      label,
      count,
    })
  );
}

function formatDiaryExerciseLine(
  item: DiaryExercise,
  exercise?: Exercise
) {
  if (!exercise) {
    return "Unbekannte Übung";
  }

  if (exercise.type === "boulder") {
    return item.boulderGrade
      ? `Boulder · Grad ${item.boulderGrade}`
      : "Boulder · ohne Grad";
  }

  return exercise.name;
}

function formatLastStats(
  item: DiaryExercise,
  exercise?: Exercise
) {
  if (!exercise) {
    return null;
  }

  if (exercise.type === "boulder") {
    return (
      <div className="last-set-list">
        <div className="last-set-row">
          <span>
            {item.boulderGrade
              ? `Grad ${item.boulderGrade}`
              : "Ohne Grad"}
          </span>

          <span>
            {item.boulderSessions ?? 1}{" "}
            Trainingstag
            {(item.boulderSessions ?? 1) !==
            1
              ? "e"
              : ""}
            {item.isFlash ? " · Flash" : ""}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="last-set-list">
      {(item.setRows ?? []).map(
        (row, index) => (
          <div
            key={row.id}
            className="last-set-row"
          >
            <span>
              Satz {index + 1}
            </span>

            <span>
              {exercise.type === "reps"
                ? `${row.weightKg ?? 0} kg · ${
                    row.reps ?? "-"
                  } Wdh.`
                : `${row.weightKg ?? 0} kg · ${
                    row.timeSeconds ?? "-"
                  } sek`}
            </span>
          </div>
        )
      )}
    </div>
  );
}