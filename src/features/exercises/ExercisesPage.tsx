import { useEffect, useMemo, useState } from "react";
import { db } from "../../db/db";
import type {
  BodyPart,
  DiaryEntry,
  DiaryExercise,
  Exercise,
  ExerciseType,
} from "../../db/types";

const bodyParts: Array<BodyPart | "Alle"> = [
  "Alle",
  "Finger",
  "Rücken",
  "Arme",
  "Core",
  "Brust",
  "Beine",
  "Ganzkörper",
  "Bouldern",
];

function formatExerciseType(type: ExerciseType) {
  if (type === "reps") return "Wiederholungen";
  if (type === "time") return "Zeit";
  return "Bouldern";
}

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [diaryExercises, setDiaryExercises] = useState<DiaryExercise[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);

  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [openMenuExerciseId, setOpenMenuExerciseId] = useState<number | null>(
    null
  );

  const [search, setSearch] = useState("");
  const [bodyPartFilter, setBodyPartFilter] = useState<BodyPart | "Alle">(
    "Alle"
  );

  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [bodyPart, setBodyPart] = useState<BodyPart>("Rücken");
  const [type, setType] = useState<ExerciseType>("reps");

  const [targetSets, setTargetSets] = useState("");
  const [targetReps, setTargetReps] = useState("");
  const [targetTimeSeconds, setTargetTimeSeconds] = useState("");
  const [notes, setNotes] = useState("");

  async function loadData() {
    const exerciseData = await db.exercises.toArray();
    const diaryExerciseData = await db.diaryExercises.toArray();
    const diaryEntryData = await db.diaryEntries.toArray();

    setExercises(exerciseData);
    setDiaryExercises(diaryExerciseData);
    setDiaryEntries(diaryEntryData);
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredExercises = useMemo(() => {
    return exercises.filter((exercise) => {
      const matchesSearch = exercise.name
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesBodyPart =
        bodyPartFilter === "Alle" || exercise.bodyPart === bodyPartFilter;

      return matchesSearch && matchesBodyPart;
    });
  }, [exercises, search, bodyPartFilter]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setBodyPart("Rücken");
    setType("reps");
    setTargetSets("");
    setTargetReps("");
    setTargetTimeSeconds("");
    setNotes("");
  }

  function openNewExerciseModal() {
    resetForm();
    setShowExerciseModal(true);
  }

  function closeExerciseModal() {
    resetForm();
    setShowExerciseModal(false);
  }

  function toggleExerciseMenu(exerciseId?: number) {
    if (!exerciseId) return;

    setOpenMenuExerciseId((current) =>
      current === exerciseId ? null : exerciseId
    );
  }

  function closeExerciseMenu() {
    setOpenMenuExerciseId(null);
  }

  async function saveExercise() {
    if (!name.trim()) {
      alert("Bitte einen Übungsnamen eingeben.");
      return;
    }

    const now = new Date().toISOString();

    const exerciseData = {
      name: name.trim(),
      bodyPart,
      type,
      targetSets:
        type !== "boulder" && targetSets ? Number(targetSets) : undefined,
      targetReps:
        type === "reps" && targetReps ? Number(targetReps) : undefined,
      targetTimeSeconds:
        type === "time" && targetTimeSeconds
          ? Number(targetTimeSeconds)
          : undefined,
      notes: notes.trim() || undefined,
      isActive: true,
      updatedAt: now,
    };

    if (editingId !== null) {
      await db.exercises.update(editingId, exerciseData);
    } else {
      await db.exercises.add({
        ...exerciseData,
        createdAt: now,
      });
    }

    resetForm();
    setShowExerciseModal(false);
    await loadData();
  }

  function startEdit(exercise: Exercise) {
    if (!exercise.id) return;

    setEditingId(exercise.id);
    setName(exercise.name);
    setBodyPart(exercise.bodyPart);
    setType(exercise.type);
    setTargetSets(exercise.targetSets?.toString() ?? "");
    setTargetReps(exercise.targetReps?.toString() ?? "");
    setTargetTimeSeconds(exercise.targetTimeSeconds?.toString() ?? "");
    setNotes(exercise.notes ?? "");

    closeExerciseMenu();
    setShowExerciseModal(true);
  }

  async function deleteExercise(exercise: Exercise) {
    if (!exercise.id) return;

    const confirmed = window.confirm(
      `Übung "${exercise.name}" wirklich löschen?`
    );

    if (!confirmed) return;

    await db.exercises.delete(exercise.id);

    if (editingId === exercise.id) {
      resetForm();
      setShowExerciseModal(false);
    }

    closeExerciseMenu();
    await loadData();
  }

  async function toggleActive(exercise: Exercise) {
    if (!exercise.id) return;

    await db.exercises.update(exercise.id, {
      isActive: !exercise.isActive,
      updatedAt: new Date().toISOString(),
    });

    closeExerciseMenu();
    await loadData();
  }

  function getLastExecution(exerciseId?: number) {
    if (!exerciseId) return null;

    const matchingItems = diaryExercises.filter(
      (item) => item.exerciseId === exerciseId
    );

    if (matchingItems.length === 0) return null;

    const entryById = new Map(
      diaryEntries
        .filter((entry) => entry.id !== undefined)
        .map((entry) => [entry.id, entry])
    );

    const sorted = [...matchingItems].sort((a, b) => {
      const entryA = entryById.get(a.diaryEntryId);
      const entryB = entryById.get(b.diaryEntryId);

      const dateA = entryA?.date ?? a.createdAt;
      const dateB = entryB?.date ?? b.createdAt;

      return dateB.localeCompare(dateA);
    });

    const lastItem = sorted[0];
    const lastEntry = entryById.get(lastItem.diaryEntryId);

    return {
      diaryExercise: lastItem,
      diaryEntry: lastEntry,
    };
  }

  return (
    <section className="card">
      <div className="page-header">
        <div>
          <h2>Übungen</h2>
          <p>Übungen anlegen, filtern und verwalten.</p>
        </div>

        <button className="primary-action-button" onClick={openNewExerciseModal}>
          Übung hinzufügen
        </button>
      </div>

      {showExerciseModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>{editingId ? "Übung bearbeiten" : "Übung hinzufügen"}</h3>
                <p>Zielwerte und Übungstyp festlegen.</p>
              </div>

              <button
                className="secondary-button small-button"
                onClick={closeExerciseModal}
              >
                Schließen
              </button>
            </div>

            <div className="form-block">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Übungsname"
              />

              <select
                value={type}
                onChange={(event) => {
                  const newType = event.target.value as ExerciseType;
                  setType(newType);

                  if (newType === "boulder") {
                    setBodyPart("Bouldern");
                    setTargetSets("");
                    setTargetReps("");
                    setTargetTimeSeconds("");
                  }
                }}
              >
                <option value="reps">Wiederholungen</option>
                <option value="time">Zeit</option>
                <option value="boulder">Bouldern</option>
              </select>

              <select
                value={bodyPart}
                disabled={type === "boulder"}
                onChange={(event) =>
                  setBodyPart(event.target.value as BodyPart)
                }
              >
                {bodyParts
                  .filter((bp) => bp !== "Alle")
                  .map((bp) => (
                    <option key={bp} value={bp}>
                      {bp}
                    </option>
                  ))}
              </select>

              {type !== "boulder" && (
                <>
                  <input
                    value={targetSets}
                    onChange={(event) => setTargetSets(event.target.value)}
                    placeholder="Ziel-Sätze"
                    type="number"
                    min="0"
                  />

                  {type === "reps" && (
                    <input
                      value={targetReps}
                      onChange={(event) => setTargetReps(event.target.value)}
                      placeholder="Ziel-Wiederholungen"
                      type="number"
                      min="0"
                    />
                  )}

                  {type === "time" && (
                    <input
                      value={targetTimeSeconds}
                      onChange={(event) =>
                        setTargetTimeSeconds(event.target.value)
                      }
                      placeholder="Ziel-Zeit in Sekunden"
                      type="number"
                      min="0"
                    />
                  )}
                </>
              )}

              {type === "boulder" && (
                <p className="hint">
                  Style, Schwierigkeit und Versuche werden später in der Session
                  erfasst.
                </p>
              )}

              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Notiz optional"
                rows={3}
              />

              <button onClick={saveExercise}>
                {editingId ? "Änderungen speichern" : "Übung anlegen"}
              </button>

              <button className="secondary-button" onClick={closeExerciseModal}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="filter-block">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Übung suchen..."
        />

        <select
          value={bodyPartFilter}
          onChange={(event) =>
            setBodyPartFilter(event.target.value as BodyPart | "Alle")
          }
        >
          {bodyParts.map((bp) => (
            <option key={bp} value={bp}>
              {bp}
            </option>
          ))}
        </select>
      </div>

      <div className="list">
        {filteredExercises.length === 0 && (
          <p>Noch keine passenden Übungen vorhanden.</p>
        )}

        {filteredExercises.map((exercise) => {
          const lastExecution = getLastExecution(exercise.id);

          return (
            <div key={exercise.id} className="list-item plan-card">
              <div className="list-item-header">
                <div>
                  <h3>{exercise.name}</h3>
                  <p>
                    {exercise.bodyPart} · {formatExerciseType(exercise.type)}
                  </p>
                </div>

                <div className="plan-menu-wrapper">
                  <button
                    className="icon-button"
                    onClick={() => toggleExerciseMenu(exercise.id)}
                    aria-label="Übungsoptionen öffnen"
                  >
                    ⋮
                  </button>

                  {openMenuExerciseId === exercise.id && (
                    <div className="plan-options-menu">
                      <button
                        className="menu-button"
                        onClick={() => startEdit(exercise)}
                      >
                        Bearbeiten
                      </button>

                      <button
                        className="menu-button"
                        onClick={() => toggleActive(exercise)}
                      >
                        {exercise.isActive ? "Deaktivieren" : "Aktivieren"}
                      </button>

                      <button
                        className="menu-button danger-menu-button"
                        onClick={() => deleteExercise(exercise)}
                      >
                        Löschen
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="details">
                <p>
                  Status:{" "}
                  <span
                    className={
                      exercise.isActive ? "status active" : "status inactive"
                    }
                  >
                    {exercise.isActive ? "Aktiv" : "Inaktiv"}
                  </span>
                </p>

                {exercise.type === "boulder" ? (
                  <p>Boulder-Daten werden in der Session erfasst.</p>
                ) : (
                  <p>
                    Ziel: {exercise.targetSets ?? "-"} Sätze ·{" "}
                    {exercise.type === "reps"
                      ? `${exercise.targetReps ?? "-"} Wdh.`
                      : `${exercise.targetTimeSeconds ?? "-"} sec`}
                  </p>
                )}

                {exercise.notes && <p>Notiz: {exercise.notes}</p>}

                <p>
                  Letzte Ausführung:{" "}
                  {lastExecution
                    ? formatLastExecution(
                        lastExecution.diaryExercise,
                        exercise.type,
                        lastExecution.diaryEntry?.date
                      )
                    : "noch keine Daten"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatLastExecution(
  diaryExercise: DiaryExercise,
  type: ExerciseType,
  date?: string
): string {
  const dateText = date ? `${date}: ` : "";

  if (type === "boulder") {
    return `${dateText}${diaryExercise.boulderStyle ?? "-"} · Grad ${
      diaryExercise.boulderGrade ?? "-"
    } · ${diaryExercise.boulderAttempts ?? "-"} Versuche`;
  }

  if (diaryExercise.setRows && diaryExercise.setRows.length > 0) {
    const rows = diaryExercise.setRows
      .map((row, index) => {
        if (type === "reps") {
          return `Satz ${index + 1}: ${row.weightKg ?? 0} kg · ${
            row.reps ?? "-"
          } Wdh.`;
        }

        return `Satz ${index + 1}: ${row.weightKg ?? 0} kg · ${
          row.timeSeconds ?? "-"
        } sec`;
      })
      .join(" | ");

    return `${dateText}${rows}`;
  }

  if (type === "reps") {
    return `${dateText}${diaryExercise.sets ?? "-"} Sätze × ${
      diaryExercise.reps ?? "-"
    } Wdh. · ${diaryExercise.weightKg ?? 0} kg`;
  }

  return `${dateText}${diaryExercise.sets ?? "-"} Sätze × ${
    diaryExercise.timeSeconds ?? "-"
  } sec · ${diaryExercise.weightKg ?? 0} kg`;
}