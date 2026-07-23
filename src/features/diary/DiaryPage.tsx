import { useEffect, useMemo, useState } from "react";
import { db } from "../../db/db";
import type {
  BoulderGrade,
  BoulderStyle,
  DiaryEntry,
  DiaryExercise,
  DiaryExerciseSet,
  Exercise,
  TrainingPlan,
  TrainingPlanExercise,
} from "../../db/types";
import {
  exportBackupJson,
  formatLastBackupDate,
  shouldShowBackupReminder,
} from "../../utils/backup";

type TimerTarget = {
  exerciseIndex: number;
};

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
  boulderAttempts: string;
  notes: string;
};

const boulderStyles: BoulderStyle[] = [
  "Slab",
  "Dyno",
  "Platte",
  "Dynamisch",
  "Leiste",
  "Parkur Style",
];

const boulderGrades: BoulderGrade[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatSeconds(value: string | number | undefined) {
  const totalSeconds = Number(value || 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function DiaryPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [diaryExercises, setDiaryExercises] = useState<DiaryExercise[]>([]);
  const [trainingPlans, setTrainingPlans] = useState<TrainingPlan[]>([]);
  const [trainingPlanExercises, setTrainingPlanExercises] = useState<
    TrainingPlanExercise[]
  >([]);

  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);

  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [showEntryActionMenu, setShowEntryActionMenu] = useState(false);

  const [date, setDate] = useState(todayIsoDate());
  const [title, setTitle] = useState("");
  const [entryNotes, setEntryNotes] = useState("");

  const [selectedExerciseIds, setSelectedExerciseIds] = useState<number[]>([]);
  const [exerciseBodyPartFilter, setExerciseBodyPartFilter] = useState("Alle");
  const [draftExercises, setDraftExercises] = useState<DraftSessionExercise[]>(
    []
  );

  const [runningTimer, setRunningTimer] = useState<TimerTarget | null>(null);
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

    setExercises(exerciseData);
    setDiaryEntries(entryData);
    setDiaryExercises(diaryExerciseData);
    setTrainingPlans(planData);
    setTrainingPlanExercises(planExerciseData);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!runningTimer) return;

    const intervalId = window.setInterval(() => {
      setTimerSeconds((current) => current + 1);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [runningTimer]);

  const activeExercises = useMemo(() => {
    return exercises
      .filter((exercise) => exercise.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises]);

  const exerciseMap = useMemo(() => {
    return new Map(
      exercises
        .filter((exercise) => exercise.id !== undefined)
        .map((exercise) => [exercise.id!, exercise])
    );
  }, [exercises]);

  const bodyPartOptions = useMemo(() => {
    const parts = Array.from(
      new Set(activeExercises.map((exercise) => exercise.bodyPart))
    );

    return ["Alle", ...parts];
  }, [activeExercises]);

  const filteredSelectableExercises = useMemo(() => {
    return activeExercises.filter((exercise) => {
      return (
        exerciseBodyPartFilter === "Alle" ||
        exercise.bodyPart === exerciseBodyPartFilter
      );
    });
  }, [activeExercises, exerciseBodyPartFilter]);

  const sortedEntries = useMemo(() => {
    return [...diaryEntries].sort((a, b) => b.date.localeCompare(a.date));
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
    setShowStatsModal(false);
  }

  function resetSession() {
    setEditingEntryId(null);
    setShowEntryActionMenu(false);
    setDate(todayIsoDate());
    setTitle("");
    setEntryNotes("");
    setSelectedExerciseIds([]);
    setExerciseBodyPartFilter("Alle");
    setDraftExercises([]);
    setRunningTimer(null);
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
    setShowSessionModal(false);
    setShowStatsModal(false);
    setShowExerciseModal(true);
  }

  function closeExerciseSelection() {
    setShowExerciseModal(false);

    if (draftExercises.length > 0) {
      setShowStatsModal(true);
    } else {
      setShowSessionModal(true);
    }
  }

  function getPlanExerciseNames(planId?: number) {
    if (!planId) return "Keine Übungen";

    const names = trainingPlanExercises
      .filter((item) => item.planId === planId)
      .sort((a, b) => a.position - b.position)
      .map((item) => exerciseMap.get(item.exerciseId)?.name)
      .filter((name): name is string => Boolean(name));

    return names.length > 0 ? names.join(" · ") : "Keine Übungen";
  }

  function createSetRows(
    exercise: Exercise,
    setCount?: number,
    reps?: number,
    timeSeconds?: number,
    weightKg?: number
  ): DraftSetRow[] {
    const count = Math.max(1, Number(setCount || exercise.targetSets || 1));

    return Array.from({ length: count }).map(() => ({
      id: makeId(),
      reps:
        exercise.type === "reps"
          ? String(reps ?? exercise.targetReps ?? "")
          : "",
      timeSeconds:
        exercise.type === "time"
          ? String(timeSeconds ?? exercise.targetTimeSeconds ?? "")
          : "",
      weightKg: weightKg !== undefined ? String(weightKg) : "",
    }));
  }

  function createDraftFromExercise(exercise: Exercise): DraftSessionExercise {
    return {
      exerciseId: exercise.id!,
      setRows: exercise.type === "boulder" ? [] : createSetRows(exercise),
      boulderStyle: "",
      boulderGrade: "",
      boulderAttempts: "",
      notes: "",
    };
  }

  function createFallbackSetRowsFromDiaryExercise(
    item: DiaryExercise,
    exercise: Exercise
  ): DraftSetRow[] {
    const setCount = Math.max(1, Number(item.sets || 1));

    return Array.from({ length: setCount }).map(() => ({
      id: makeId(),
      reps: exercise.type === "reps" ? item.reps?.toString() ?? "" : "",
      timeSeconds:
        exercise.type === "time" ? item.timeSeconds?.toString() ?? "" : "",
      weightKg: item.weightKg?.toString() ?? "",
    }));
  }

  function convertDiaryExerciseToDraft(item: DiaryExercise): DraftSessionExercise {
    const exercise = exerciseMap.get(item.exerciseId);

    if (!exercise) {
      return {
        id: item.id,
        exerciseId: item.exerciseId,
        setRows: [],
        boulderStyle: item.boulderStyle ?? "",
        boulderGrade: item.boulderGrade ?? "",
        boulderAttempts: item.boulderAttempts?.toString() ?? "",
        notes: item.notes ?? "",
      };
    }

    if (item.setRows && item.setRows.length > 0) {
      return {
        id: item.id,
        exerciseId: item.exerciseId,
        setRows: item.setRows.map((row) => ({
          id: row.id || makeId(),
          reps: row.reps?.toString() ?? "",
          timeSeconds: row.timeSeconds?.toString() ?? "",
          weightKg: row.weightKg?.toString() ?? "",
        })),
        boulderStyle: item.boulderStyle ?? "",
        boulderGrade: item.boulderGrade ?? "",
        boulderAttempts: item.boulderAttempts?.toString() ?? "",
        notes: item.notes ?? "",
      };
    }

    return {
      id: item.id,
      exerciseId: item.exerciseId,
      setRows:
        exercise.type === "boulder"
          ? []
          : createFallbackSetRowsFromDiaryExercise(item, exercise),
      boulderStyle: item.boulderStyle ?? "",
      boulderGrade: item.boulderGrade ?? "",
      boulderAttempts: item.boulderAttempts?.toString() ?? "",
      notes: item.notes ?? "",
    };
  }

  function loadPlanIntoStats(plan: TrainingPlan) {
    if (!plan.id) return;

    const planItems = trainingPlanExercises
      .filter((item) => item.planId === plan.id)
      .sort((a, b) => a.position - b.position);

    if (planItems.length === 0) {
      alert("Dieser Trainingsplan enthält noch keine Übungen.");
      return;
    }

    const draftItems = planItems
      .map((item): DraftSessionExercise | null => {
        const exercise = exerciseMap.get(item.exerciseId);

        if (!exercise) return null;

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
          boulderStyle: "",
          boulderGrade: "",
          boulderAttempts: "",
          notes: item.notes ?? "",
        };
      })
      .filter((item): item is DraftSessionExercise => item !== null);

    setDraftExercises(draftItems);

    if (!title.trim()) {
      setTitle(plan.name);
    }

    setShowPlanModal(false);
    setShowStatsModal(true);
  }

  function toggleExerciseSelection(exerciseId?: number) {
    if (!exerciseId) return;

    setSelectedExerciseIds((current) => {
      if (current.includes(exerciseId)) {
        return current.filter((id) => id !== exerciseId);
      }

      return [...current, exerciseId];
    });
  }

  function continueFromExerciseSelection() {
    if (selectedExerciseIds.length === 0) {
      alert("Bitte mindestens eine Übung auswählen.");
      return;
    }

    const newDraftItems = selectedExerciseIds
      .map((exerciseId) => {
        const exercise = exerciseMap.get(exerciseId);

        if (!exercise) return null;

        return createDraftFromExercise(exercise);
      })
      .filter((item): item is DraftSessionExercise => Boolean(item));

    setDraftExercises((current) => [...current, ...newDraftItems]);
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
      current.map((exerciseItem, currentExerciseIndex) => {
        if (currentExerciseIndex !== exerciseIndex) return exerciseItem;

        return {
          ...exerciseItem,
          setRows: exerciseItem.setRows.map((setRow, currentSetIndex) => {
            if (currentSetIndex !== setIndex) return setRow;

            return {
              ...setRow,
              [field]: value,
            };
          }),
        };
      })
    );
  }

  function updateDraftExercise(
    exerciseIndex: number,
    updates: Partial<DraftSessionExercise>
  ) {
    setDraftExercises((current) =>
      current.map((exerciseItem, currentExerciseIndex) =>
        currentExerciseIndex === exerciseIndex
          ? {
              ...exerciseItem,
              ...updates,
            }
          : exerciseItem
      )
    );
  }

  function updateExerciseNotes(exerciseIndex: number, value: string) {
    updateDraftExercise(exerciseIndex, {
      notes: value,
    });
  }

  function addSetRow(exerciseIndex: number) {
    setDraftExercises((current) =>
      current.map((exerciseItem, currentExerciseIndex) => {
        if (currentExerciseIndex !== exerciseIndex) return exerciseItem;

        const lastRow = exerciseItem.setRows[exerciseItem.setRows.length - 1];

        return {
          ...exerciseItem,
          setRows: [
            ...exerciseItem.setRows,
            {
              id: makeId(),
              reps: lastRow?.reps ?? "",
              timeSeconds: lastRow?.timeSeconds ?? "",
              weightKg: lastRow?.weightKg ?? "",
            },
          ],
        };
      })
    );
  }

  function removeSetRow(exerciseIndex: number, setIndex: number) {
    setDraftExercises((current) =>
      current.map((exerciseItem, currentExerciseIndex) => {
        if (currentExerciseIndex !== exerciseIndex) return exerciseItem;

        const nextRows = exerciseItem.setRows.filter(
          (_, currentSetIndex) => currentSetIndex !== setIndex
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
      })
    );
  }

  function removeDraftExercise(exerciseIndex: number) {
    if (runningTimer?.exerciseIndex === exerciseIndex) {
      setRunningTimer(null);
      setTimerSeconds(0);
    }

    setDraftExercises((current) =>
      current.filter((_, currentIndex) => currentIndex !== exerciseIndex)
    );
  }

  function startTimer(exerciseIndex: number) {
    setTimerSeconds(0);
    setRunningTimer({ exerciseIndex });
  }

  function stopTimer() {
    setRunningTimer(null);
  }

  function resetTimer() {
    setRunningTimer(null);
    setTimerSeconds(0);
  }

  function getLastStatsForExercise(exerciseId: number) {
    const currentEntryId = editingEntryId;

    const candidates = diaryExercises
      .filter((item) => {
        if (item.exerciseId !== exerciseId) return false;

        if (currentEntryId && item.diaryEntryId === currentEntryId) {
          return false;
        }

        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return candidates[0] ?? null;
  }

  function validateDraft() {
    if (draftExercises.length === 0) {
      alert("Bitte mindestens eine Übung hinzufügen.");
      return false;
    }

    for (const draftExercise of draftExercises) {
      const exercise = exerciseMap.get(draftExercise.exerciseId);

      if (!exercise) {
        alert("Eine Übung wurde nicht gefunden.");
        return false;
      }

      if (exercise.type === "boulder") {
        if (!draftExercise.boulderStyle) {
          alert(`Bitte Style für "${exercise.name}" auswählen.`);
          return false;
        }

        if (!draftExercise.boulderGrade) {
          alert(`Bitte Schwierigkeit für "${exercise.name}" auswählen.`);
          return false;
        }

        if (!draftExercise.boulderAttempts.trim()) {
          alert(`Bitte Anzahl Versuche für "${exercise.name}" eintragen.`);
          return false;
        }

        continue;
      }

      if (draftExercise.setRows.length === 0) {
        alert(`Bitte mindestens einen Satz für "${exercise.name}" eintragen.`);
        return false;
      }

      for (const [index, setRow] of draftExercise.setRows.entries()) {
        if (exercise.type === "reps" && !setRow.reps.trim()) {
          alert(
            `Bitte Wiederholungen für "${exercise.name}", Satz ${
              index + 1
            } eintragen.`
          );
          return false;
        }

        if (exercise.type === "time" && !setRow.timeSeconds.trim()) {
          alert(
            `Bitte Zeit für "${exercise.name}", Satz ${index + 1} eintragen.`
          );
          return false;
        }
      }
    }

    return true;
  }

  function toSavedSetRows(item: DraftSessionExercise, exercise?: Exercise) {
    const rows: DiaryExerciseSet[] = item.setRows.map((row) => ({
      id: row.id,
      reps:
        exercise?.type === "reps" && row.reps ? Number(row.reps) : undefined,
      timeSeconds:
        exercise?.type === "time" && row.timeSeconds
          ? Number(row.timeSeconds)
          : undefined,
      weightKg: row.weightKg ? Number(row.weightKg) : 0,
    }));

    return rows;
  }

  function buildDiaryExercisePayload(
    entryId: number,
    item: DraftSessionExercise,
    now: string
  ) {
    const exercise = exerciseMap.get(item.exerciseId);
    const savedRows = toSavedSetRows(item, exercise);

    if (exercise?.type === "boulder") {
      return {
        diaryEntryId: entryId,
        exerciseId: item.exerciseId,
        boulderStyle: item.boulderStyle || undefined,
        boulderGrade: item.boulderGrade || undefined,
        boulderAttempts: item.boulderAttempts
          ? Number(item.boulderAttempts)
          : undefined,
        notes: item.notes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };
    }

    return {
      diaryEntryId: entryId,
      exerciseId: item.exerciseId,
      sets: savedRows.length,
      reps:
        exercise?.type === "reps" && savedRows[0]?.reps !== undefined
          ? savedRows[0].reps
          : undefined,
      timeSeconds:
        exercise?.type === "time" && savedRows[0]?.timeSeconds !== undefined
          ? savedRows[0].timeSeconds
          : undefined,
      weightKg: savedRows[0]?.weightKg ?? 0,
      setRows: savedRows,
      notes: item.notes.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
  }

  async function saveSession() {
    if (!validateDraft()) return;

    const now = new Date().toISOString();

    if (editingEntryId) {
      const entryId = editingEntryId;

      await db.transaction("rw", db.diaryEntries, db.diaryExercises, async () => {
        await db.diaryEntries.update(entryId, {
          date,
          title: title.trim() || "Session",
          notes: entryNotes.trim() || undefined,
          updatedAt: now,
        });

        await db.diaryExercises.where("diaryEntryId").equals(entryId).delete();

        await db.diaryExercises.bulkAdd(
          draftExercises.map((item) =>
            buildDiaryExercisePayload(entryId, item, now)
          )
        );
      });
    } else {
      const entryId = await db.diaryEntries.add({
        date,
        title: title.trim() || "Session",
        notes: entryNotes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      });

      await db.diaryExercises.bulkAdd(
        draftExercises.map((item) => buildDiaryExercisePayload(entryId, item, now))
      );
    }

    resetSession();
    resetAllModals();
    await loadData();
  }

  function editSession(entry: DiaryEntry) {
    if (!entry.id) return;

    const items = diaryExercises
      .filter((item) => item.diaryEntryId === entry.id)
      .map((item) => convertDiaryExerciseToDraft(item));

    setEditingEntryId(entry.id);
    setShowEntryActionMenu(false);
    setDate(entry.date);
    setTitle(entry.title ?? "");
    setEntryNotes(entry.notes ?? "");
    setDraftExercises(items);
    setSelectedExerciseIds([]);
    resetAllModals();
    setShowStatsModal(true);
  }

  async function deleteCurrentEditingSession() {
    if (!editingEntryId) return;

    const confirmed = window.confirm("Diese Session wirklich löschen?");

    if (!confirmed) return;

    await db.transaction("rw", db.diaryEntries, db.diaryExercises, async () => {
      await db.diaryExercises.where("diaryEntryId").equals(editingEntryId).delete();
      await db.diaryEntries.delete(editingEntryId);
    });

    setShowEntryActionMenu(false);
    resetSession();
    resetAllModals();
    await loadData();
  }

  function getExercisesForEntry(entryId?: number) {
    if (!entryId) return [];

    return diaryExercises.filter((item) => item.diaryEntryId === entryId);
  }

  return (
    <section className="card">
      <div className="page-header">
        <div>
          <h2>Tagebuch</h2>
          <p>Sessions erfassen und nach Datum anzeigen.</p>
        </div>

        <button className="primary-action-button" onClick={openNewSession}>
          Session hinzufügen
        </button>
      </div>

      {backupReminderVisible && (
        <div className="backup-banner">
          <div>
            <h3>Backup empfohlen</h3>
            <p>Letztes Backup: {formatLastBackupDate()}</p>
            <p>
              Deine Daten liegen lokal auf diesem Gerät. Erstelle regelmäßig ein
              Backup, damit beim Browserdaten-Löschen oder Gerätewechsel nichts
              verloren geht.
            </p>
          </div>

          <button
            className="primary-action-button"
            onClick={handleDiaryBackupExport}
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
                <h3>{editingEntryId ? "Session bearbeiten" : "Neue Session"}</h3>
                <p>Datum und Namen festlegen.</p>
              </div>

              <button className="secondary-button small-button" onClick={closeAll}>
                Schließen
              </button>
            </div>

            <div className="form-block">
              <label className="field-label">Datum</label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />

              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Session-Name, z. B. Pull Training"
              />

              <textarea
                value={entryNotes}
                onChange={(event) => setEntryNotes(event.target.value)}
                placeholder="Notiz zur Session optional"
                rows={2}
              />

              <button onClick={openPlanSelection}>Trainingsplan laden</button>

              <button className="secondary-button" onClick={openExerciseSelection}>
                Übungen hinzufügen
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
                <h3>Trainingsplan laden</h3>
                <p>Wähle einen Plan. Danach trägst du die Sätze ein.</p>
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
              {trainingPlans.length === 0 && (
                <p>Noch keine Trainingspläne vorhanden.</p>
              )}

              {trainingPlans.map((plan) => (
                <div key={plan.id} className="list-item">
                  <h3>{plan.name}</h3>

                  {plan.description && <p>{plan.description}</p>}

                  <p>
                    Übungen: <strong>{getPlanExerciseNames(plan.id)}</strong>
                  </p>

                  <button onClick={() => loadPlanIntoStats(plan)}>
                    Plan auswählen
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showExerciseModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>Übungen hinzufügen</h3>
                <p>Filtere nach Körperteil und wähle Übungen aus.</p>
              </div>

              <button
                className="secondary-button small-button"
                onClick={closeExerciseSelection}
              >
                Zurück
              </button>
            </div>

            <div className="filter-block">
              <select
                value={exerciseBodyPartFilter}
                onChange={(event) => setExerciseBodyPartFilter(event.target.value)}
              >
                {bodyPartOptions.map((bodyPart) => (
                  <option key={bodyPart} value={bodyPart}>
                    {bodyPart}
                  </option>
                ))}
              </select>
            </div>

            <div className="list">
              {filteredSelectableExercises.length === 0 && (
                <p>Keine passenden Übungen gefunden.</p>
              )}

              {filteredSelectableExercises.map((exercise) => (
                <div key={exercise.id} className="list-item">
                  <div className="list-item-header">
                    <div>
                      <h3>{exercise.name}</h3>
                      <p>
                        {exercise.bodyPart} ·{" "}
                        {exercise.type === "reps"
                          ? "Wiederholungen"
                          : exercise.type === "time"
                          ? "Zeit"
                          : "Bouldern"}
                      </p>
                    </div>

                    <input
                      type="checkbox"
                      checked={
                        exercise.id !== undefined &&
                        selectedExerciseIds.includes(exercise.id)
                      }
                      onChange={() => toggleExerciseSelection(exercise.id)}
                      className="checkbox-input"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="session-action-row">
              <button onClick={continueFromExerciseSelection}>
                Weiter zu Sätzen
              </button>

              <button className="secondary-button" onClick={closeExerciseSelection}>
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
                <h3>{editingEntryId ? "Session bearbeiten" : "Sätze eintragen"}</h3>
                <p>Jeder Satz ist eine eigene Zeile mit Gewicht und Wert.</p>
              </div>

              <div className="plan-menu-wrapper">
                {editingEntryId && (
                  <>
                    <button
                      className="icon-button"
                      onClick={() =>
                        setShowEntryActionMenu((current) => !current)
                      }
                      aria-label="Session Optionen öffnen"
                    >
                      ⋮
                    </button>

                    {showEntryActionMenu && (
                      <div className="plan-options-menu">
                        <button
                          className="menu-button danger-menu-button"
                          onClick={deleteCurrentEditingSession}
                        >
                          Löschen
                        </button>
                      </div>
                    )}
                  </>
                )}

                {!editingEntryId && (
                  <button
                    className="secondary-button small-button"
                    onClick={closeAll}
                  >
                    Schließen
                  </button>
                )}
              </div>
            </div>

            <div className="form-block">
              <label className="field-label">Datum</label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />

              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Session-Name"
              />

              <textarea
                value={entryNotes}
                onChange={(event) => setEntryNotes(event.target.value)}
                placeholder="Notiz zur Session optional"
                rows={2}
              />
            </div>

            <div className="session-action-row">
              <button className="secondary-button" onClick={openExerciseSelection}>
                Weitere Übungen hinzufügen
              </button>
            </div>

            <div className="list">
              {draftExercises.map((draftExercise, exerciseIndex) => {
                const exercise = exerciseMap.get(draftExercise.exerciseId);
                const previousStats = getLastStatsForExercise(
                  draftExercise.exerciseId
                );

                const isTimeExercise = exercise?.type === "time";
                const isBoulderExercise = exercise?.type === "boulder";
                const isTimerRunning =
                  runningTimer?.exerciseIndex === exerciseIndex;

                return (
                  <div
                    key={`${draftExercise.exerciseId}-${exerciseIndex}`}
                    className="list-item"
                  >
                    <div className="list-item-header">
                      <div>
                        <h3>
                          {exerciseIndex + 1}.{" "}
                          {exercise?.name ?? "Unbekannte Übung"}
                        </h3>
                        <p>
                          {exercise?.type === "reps"
                            ? "Wiederholungen"
                            : exercise?.type === "time"
                            ? "Zeit"
                            : "Bouldern"}
                        </p>
                      </div>

                      <button
                        className="danger-button small-button"
                        onClick={() => removeDraftExercise(exerciseIndex)}
                      >
                        Entfernen
                      </button>
                    </div>

                    {previousStats && (
                      <div className="last-stats-box">
                        <strong>Letzte Session:</strong>
                        {formatLastStats(previousStats, exercise)}
                      </div>
                    )}

                    {isBoulderExercise && (
                      <div className="form-block compact">
                        <select
                          value={draftExercise.boulderStyle}
                          onChange={(event) =>
                            updateDraftExercise(exerciseIndex, {
                              boulderStyle: event.target.value as BoulderStyle,
                            })
                          }
                        >
                          <option value="">Style auswählen</option>
                          {boulderStyles.map((style) => (
                            <option key={style} value={style}>
                              {style}
                            </option>
                          ))}
                        </select>

                        <select
                          value={draftExercise.boulderGrade}
                          onChange={(event) =>
                            updateDraftExercise(exerciseIndex, {
                              boulderGrade: Number(
                                event.target.value
                              ) as BoulderGrade,
                            })
                          }
                        >
                          <option value="">Schwierigkeit auswählen</option>
                          {boulderGrades.map((grade) => (
                            <option key={grade} value={grade}>
                              Grad {grade}
                            </option>
                          ))}
                        </select>

                        <div className="input-with-unit">
                          <input
                            type="number"
                            min="0"
                            value={draftExercise.boulderAttempts}
                            onChange={(event) =>
                              updateDraftExercise(exerciseIndex, {
                                boulderAttempts: event.target.value,
                              })
                            }
                            placeholder="0"
                          />
                          <span>Versuche</span>
                        </div>
                      </div>
                    )}

                    {!isBoulderExercise && (
                      <>
                        <div className="set-table">
                          {draftExercise.setRows.map((setRow, setIndex) => (
                            <div key={setRow.id} className="set-row">
                              <span className="set-number">
                                Satz {setIndex + 1}
                              </span>

                              <div className="input-with-unit">
                                <input
                                  type="number"
                                  value={setRow.weightKg}
                                  onChange={(event) =>
                                    updateSetRow(
                                      exerciseIndex,
                                      setIndex,
                                      "weightKg",
                                      event.target.value
                                    )
                                  }
                                  placeholder="0"
                                />
                                <span>kg</span>
                              </div>

                              {exercise?.type === "reps" && (
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
                                        event.target.value
                                      )
                                    }
                                    placeholder="0"
                                  />
                                  <span>Wdh.</span>
                                </div>
                              )}

                              {isTimeExercise && (
                                <div className="input-with-unit">
                                  <input
                                    type="number"
                                    min="0"
                                    value={setRow.timeSeconds}
                                    onChange={(event) =>
                                      updateSetRow(
                                        exerciseIndex,
                                        setIndex,
                                        "timeSeconds",
                                        event.target.value
                                      )
                                    }
                                    placeholder="0"
                                  />
                                  <span>sek</span>
                                </div>
                              )}

                              <button
                                className="danger-button small-button"
                                onClick={() =>
                                  removeSetRow(exerciseIndex, setIndex)
                                }
                              >
                                −
                              </button>
                            </div>
                          ))}
                        </div>

                        {isTimeExercise && (
                          <div className="timer-box">
                            <strong>Stoppuhr: {formatSeconds(timerSeconds)}</strong>

                            <div className="session-action-row">
                              {!isTimerRunning ? (
                                <button
                                  onClick={() => startTimer(exerciseIndex)}
                                >
                                  Start
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
                              >
                                Reset
                              </button>
                            </div>
                          </div>
                        )}

                        <button
                          className="secondary-button"
                          onClick={() => addSetRow(exerciseIndex)}
                        >
                          + Satz hinzufügen
                        </button>
                      </>
                    )}

                    <textarea
                      value={draftExercise.notes}
                      onChange={(event) =>
                        updateExerciseNotes(exerciseIndex, event.target.value)
                      }
                      placeholder={
                        isBoulderExercise
                          ? "Notiz zum Boulder optional"
                          : "Notiz zur Übung optional"
                      }
                      rows={2}
                    />
                  </div>
                );
              })}
            </div>

            <div className="session-action-row">
              <button onClick={saveSession}>
                {editingEntryId ? "Session speichern" : "Session anlegen"}
              </button>

              <button
                className="secondary-button"
                onClick={() => {
                  setShowStatsModal(false);
                  setShowSessionModal(true);
                }}
              >
                Zurück
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="list">
        {sortedEntries.length === 0 && <p>Noch keine Sessions vorhanden.</p>}

        {sortedEntries.map((entry) => {
          const items = getExercisesForEntry(entry.id);

          return (
            <article
              key={entry.id}
              className="list-item session-overview-card"
              onClick={() => editSession(entry)}
            >
              <div className="list-item-header">
                <div>
                  <h3>{entry.title || "Session"}</h3>
                  <p>{entry.date}</p>
                </div>
              </div>

              {entry.notes && <p>Notiz: {entry.notes}</p>}

              <div className="session-exercise-summary">
                {items.length === 0 && <p>Keine Übungen in dieser Session.</p>}

                {items.map((item) => {
                  const exercise = exerciseMap.get(item.exerciseId);

                  return (
                    <div key={item.id} className="session-exercise-line">
                      {formatDiaryExerciseLine(item, exercise)}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatDiaryExerciseLine(item: DiaryExercise, exercise?: Exercise) {
  if (!exercise) return "Unbekannte Übung";

  if (exercise.type === "boulder") {
    return `Boulder · ${item.boulderStyle ?? "-"} · Grad ${
      item.boulderGrade ?? "-"
    }`;
  }

  return exercise.name;
}

function formatLastStats(item: DiaryExercise, exercise?: Exercise) {
  return (
    <div className="last-set-list">
      <div className="last-set-row">
        <span>Letzte Session</span>
        <span>{formatDiaryExerciseLine(item, exercise)}</span>
      </div>
    </div>
  );
}