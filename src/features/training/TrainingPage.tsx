
import { useEffect, useMemo, useState } from "react";
import { db } from "../../db/db";
import type {
  BodyPart,
  Exercise,
  TrainingPlan,
  TrainingPlanExercise,
} from "../../db/types";
import ExercisesPage from "../exercises/ExercisesPage";

type TrainingTab = "plans" | "exercises";

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

function formatExerciseType(type: Exercise["type"]) {
  if (type === "reps") return "Wiederholungen";
  if (type === "time") return "Zeit";
  return "Bouldern";
}

export default function TrainingPage() {
  const [trainingTab, setTrainingTab] = useState<TrainingTab>("plans");

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [planExercises, setPlanExercises] = useState<TrainingPlanExercise[]>(
    []
  );

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showPlanDetailModal, setShowPlanDetailModal] = useState(false);

  const [planName, setPlanName] = useState("");
  const [planDescription, setPlanDescription] = useState("");
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);

  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [openMenuPlanId, setOpenMenuPlanId] = useState<number | null>(null);

  const [exerciseBodyPartFilter, setExerciseBodyPartFilter] =
    useState<BodyPart | "">("");
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | "">("");

  const [defaultSets, setDefaultSets] = useState("");
  const [defaultReps, setDefaultReps] = useState("");
  const [defaultTimeSeconds, setDefaultTimeSeconds] = useState("");
  const [defaultWeightKg, setDefaultWeightKg] = useState("");
  const [notes, setNotes] = useState("");

  async function loadData() {
    const exerciseData = await db.exercises.toArray();
    const planData = await db.trainingPlans.toArray();
    const planExerciseData = await db.trainingPlanExercises.toArray();

    setExercises(exerciseData);
    setPlans(planData);
    setPlanExercises(planExerciseData);
  }

  useEffect(() => {
    loadData();
  }, []);

  const activeExercises = useMemo(() => {
    return exercises
      .filter((exercise) => exercise.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises]);

  const filteredPlanExercises = useMemo(() => {
    if (!exerciseBodyPartFilter) return [];

    return activeExercises.filter(
      (exercise) => exercise.bodyPart === exerciseBodyPartFilter
    );
  }, [activeExercises, exerciseBodyPartFilter]);

  const exerciseMap = useMemo(() => {
    return new Map(
      exercises
        .filter((exercise) => exercise.id !== undefined)
        .map((exercise) => [exercise.id!, exercise])
    );
  }, [exercises]);

  const selectedExercise = useMemo(() => {
    if (!selectedExerciseId) return null;

    return exerciseMap.get(selectedExerciseId) ?? null;
  }, [selectedExerciseId, exerciseMap]);

  const selectedPlan = useMemo(() => {
    if (!selectedPlanId) return null;

    return plans.find((plan) => plan.id === selectedPlanId) ?? null;
  }, [plans, selectedPlanId]);

  const sortedPlans = useMemo(() => {
    return [...plans].sort((a, b) => {
      const positionA = a.position ?? Number.MAX_SAFE_INTEGER;
      const positionB = b.position ?? Number.MAX_SAFE_INTEGER;

      if (positionA !== positionB) {
        return positionA - positionB;
      }

      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [plans]);

  const selectedPlanExercises = useMemo(() => {
    if (!selectedPlanId) return [];

    return planExercises
      .filter((item) => item.planId === selectedPlanId)
      .sort((a, b) => a.position - b.position);
  }, [planExercises, selectedPlanId]);

  function getPlanExerciseNames(planId?: number) {
    if (!planId) return "Keine Übungen";

    const names = planExercises
      .filter((item) => item.planId === planId)
      .sort((a, b) => a.position - b.position)
      .map((item) => exerciseMap.get(item.exerciseId)?.name)
      .filter(Boolean);

    if (names.length === 0) return "Keine Übungen";

    return names.join(" · ");
  }

  function getNextPlanPosition() {
    if (plans.length === 0) return 1;

    const maxPosition = Math.max(
      ...plans.map((plan, index) => plan.position ?? index + 1)
    );

    return maxPosition + 1;
  }

  function resetPlanForm() {
    setEditingPlanId(null);
    setPlanName("");
    setPlanDescription("");
  }

  function resetPlanExerciseForm() {
    setExerciseBodyPartFilter("");
    setSelectedExerciseId("");
    setDefaultSets("");
    setDefaultReps("");
    setDefaultTimeSeconds("");
    setDefaultWeightKg("");
    setNotes("");
  }

  function openNewPlanModal() {
    resetPlanForm();
    setShowPlanModal(true);
  }

  function closePlanModal() {
    resetPlanForm();
    setShowPlanModal(false);
  }

  function openPlanDetailModal(planId: number) {
    setSelectedPlanId(planId);
    resetPlanExerciseForm();
    setShowPlanDetailModal(true);
  }

  function closePlanDetailModal() {
    resetPlanExerciseForm();
    setShowPlanDetailModal(false);
  }

  function togglePlanMenu(planId?: number) {
    if (!planId) return;

    setOpenMenuPlanId((current) => (current === planId ? null : planId));
  }

  function closePlanMenu() {
    setOpenMenuPlanId(null);
  }

  function resetDefaultValues() {
    setSelectedExerciseId("");
    setDefaultSets("");
    setDefaultReps("");
    setDefaultTimeSeconds("");
    setDefaultWeightKg("");
  }

  function prefillFromExercise(exerciseIdValue: number | "") {
    setSelectedExerciseId(exerciseIdValue);

    if (!exerciseIdValue) {
      setDefaultSets("");
      setDefaultReps("");
      setDefaultTimeSeconds("");
      setDefaultWeightKg("");
      return;
    }

    const exercise = exerciseMap.get(exerciseIdValue);

    if (!exercise) return;

    if (exercise.type === "boulder") {
      setDefaultSets("");
      setDefaultReps("");
      setDefaultTimeSeconds("");
      setDefaultWeightKg("");
      return;
    }

    setDefaultSets(exercise.targetSets?.toString() ?? "");
    setDefaultReps(exercise.targetReps?.toString() ?? "");
    setDefaultTimeSeconds(exercise.targetTimeSeconds?.toString() ?? "");
    setDefaultWeightKg("");
  }

  async function savePlan() {
    if (!planName.trim()) {
      alert("Bitte einen Namen für den Trainingsplan eingeben.");
      return;
    }

    const now = new Date().toISOString();

    if (editingPlanId) {
      await db.trainingPlans.update(editingPlanId, {
        name: planName.trim(),
        description: planDescription.trim() || undefined,
        updatedAt: now,
      });

      setSelectedPlanId(editingPlanId);
      setShowPlanModal(false);
      setShowPlanDetailModal(true);
    } else {
      const newPlanId = await db.trainingPlans.add({
        name: planName.trim(),
        description: planDescription.trim() || undefined,
        position: getNextPlanPosition(),
        createdAt: now,
        updatedAt: now,
      });

      setSelectedPlanId(newPlanId);
      setShowPlanModal(false);
      setShowPlanDetailModal(true);
    }

    resetPlanForm();
    await loadData();
  }

  function startEditPlan(plan: TrainingPlan) {
    setEditingPlanId(plan.id ?? null);
    setPlanName(plan.name);
    setPlanDescription(plan.description ?? "");
    closePlanMenu();
    setShowPlanModal(true);
  }

  async function deletePlan(plan: TrainingPlan) {
    if (!plan.id) return;

    const confirmed = window.confirm(
      `Trainingsplan "${plan.name}" wirklich löschen?`
    );

    if (!confirmed) return;

    await db.transaction(
      "rw",
      db.trainingPlans,
      db.trainingPlanExercises,
      async () => {
        await db.trainingPlanExercises.where("planId").equals(plan.id!).delete();
        await db.trainingPlans.delete(plan.id!);
      }
    );

    if (selectedPlanId === plan.id) {
      setSelectedPlanId(null);
      setShowPlanDetailModal(false);
    }

    closePlanMenu();
    resetPlanForm();
    resetPlanExerciseForm();
    await loadData();
  }

  async function movePlanUp(plan: TrainingPlan) {
    if (!plan.id) return;

    const currentIndex = sortedPlans.findIndex((item) => item.id === plan.id);

    if (currentIndex <= 0) return;

    const previousPlan = sortedPlans[currentIndex - 1];

    if (!previousPlan.id) return;

    const currentPosition = plan.position ?? currentIndex + 1;
    const previousPosition = previousPlan.position ?? currentIndex;

    await db.transaction("rw", db.trainingPlans, async () => {
      await db.trainingPlans.update(plan.id!, {
        position: previousPosition,
      });

      await db.trainingPlans.update(previousPlan.id!, {
        position: currentPosition,
      });
    });

    await loadData();
  }

  async function movePlanDown(plan: TrainingPlan) {
    if (!plan.id) return;

    const currentIndex = sortedPlans.findIndex((item) => item.id === plan.id);

    if (currentIndex === -1 || currentIndex >= sortedPlans.length - 1) return;

    const nextPlan = sortedPlans[currentIndex + 1];

    if (!nextPlan.id) return;

    const currentPosition = plan.position ?? currentIndex + 1;
    const nextPosition = nextPlan.position ?? currentIndex + 2;

    await db.transaction("rw", db.trainingPlans, async () => {
      await db.trainingPlans.update(plan.id!, {
        position: nextPosition,
      });

      await db.trainingPlans.update(nextPlan.id!, {
        position: currentPosition,
      });
    });

    await loadData();
  }

  async function addExerciseToPlan() {
    if (!selectedPlanId) {
      alert("Bitte zuerst einen Trainingsplan auswählen.");
      return;
    }

    if (!selectedExerciseId) {
      alert("Bitte eine Übung auswählen.");
      return;
    }

    const exercise = exerciseMap.get(selectedExerciseId);

    if (!exercise) {
      alert("Die ausgewählte Übung wurde nicht gefunden.");
      return;
    }

    if (exercise.type !== "boulder" && !defaultSets.trim()) {
      alert("Bitte Standard-Sätze eintragen.");
      return;
    }

    if (exercise.type === "reps" && !defaultReps.trim()) {
      alert("Bitte Standard-Wiederholungen eintragen.");
      return;
    }

    if (exercise.type === "time" && !defaultTimeSeconds.trim()) {
      alert("Bitte Standard-Zeit eintragen.");
      return;
    }

    const nextPosition =
      selectedPlanExercises.length === 0
        ? 1
        : Math.max(...selectedPlanExercises.map((item) => item.position)) + 1;

    await db.trainingPlanExercises.add({
      planId: selectedPlanId,
      exerciseId: selectedExerciseId,
      position: nextPosition,
      defaultSets:
        exercise.type !== "boulder" && defaultSets
          ? Number(defaultSets)
          : undefined,
      defaultReps:
        exercise.type === "reps" && defaultReps
          ? Number(defaultReps)
          : undefined,
      defaultTimeSeconds:
        exercise.type === "time" && defaultTimeSeconds
          ? Number(defaultTimeSeconds)
          : undefined,
      defaultWeightKg:
        exercise.type !== "boulder" && defaultWeightKg
          ? Number(defaultWeightKg)
          : 0,
      notes: notes.trim() || undefined,
    });

    resetPlanExerciseForm();
    await loadData();
  }

  async function removeExerciseFromPlan(item: TrainingPlanExercise) {
    if (!item.id) return;

    await db.trainingPlanExercises.delete(item.id);
    await loadData();
  }

  async function movePlanExerciseUp(item: TrainingPlanExercise) {
    if (!item.id || !selectedPlanId) return;

    const currentIndex = selectedPlanExercises.findIndex(
      (exercise) => exercise.id === item.id
    );

    if (currentIndex <= 0) return;

    const previousItem = selectedPlanExercises[currentIndex - 1];

    if (!previousItem.id) return;

    await db.transaction("rw", db.trainingPlanExercises, async () => {
      await db.trainingPlanExercises.update(item.id!, {
        position: previousItem.position,
      });

      await db.trainingPlanExercises.update(previousItem.id!, {
        position: item.position,
      });
    });

    await loadData();
  }

  async function movePlanExerciseDown(item: TrainingPlanExercise) {
    if (!item.id || !selectedPlanId) return;

    const currentIndex = selectedPlanExercises.findIndex(
      (exercise) => exercise.id === item.id
    );

    if (
      currentIndex === -1 ||
      currentIndex >= selectedPlanExercises.length - 1
    ) {
      return;
    }

    const nextItem = selectedPlanExercises[currentIndex + 1];

    if (!nextItem.id) return;

    await db.transaction("rw", db.trainingPlanExercises, async () => {
      await db.trainingPlanExercises.update(item.id!, {
        position: nextItem.position,
      });

      await db.trainingPlanExercises.update(nextItem.id!, {
        position: item.position,
      });
    });

    await loadData();
  }

  return (
    <section className="card">
      <div className="page-header">
        <div>
          <h2>
            {trainingTab === "plans" ? "Trainingspläne" : "Übungen"}
          </h2>

          <p>
            {trainingTab === "plans"
              ? "Trainingspläne erstellen."
              : "Übungen verwalten."}
          </p>
        </div>

        {trainingTab === "plans" && (
          <button
            className="primary-action-button"
            onClick={openNewPlanModal}
          >
            Plan hinzufügen
          </button>
        )}

        {trainingTab === "exercises" && (
          <button
            className="primary-action-button"
            onClick={() =>
              window.dispatchEvent(new Event("openExerciseModal"))
            }
          >
            Übung hinzufügen
          </button>
        )}
      </div>

      <div className="stats-tab-bar">
        <button
          className={trainingTab === "plans" ? "active-tab" : ""}
          onClick={() => setTrainingTab("plans")}
        >
          Trainingspläne
        </button>

        <button
          className={trainingTab === "exercises" ? "active-tab" : ""}
          onClick={() => setTrainingTab("exercises")}
        >
          Übungen
        </button>
      </div>

      {trainingTab === "plans" && (
        <>
          <div className="list">
            {sortedPlans.length === 0 && (
              <p>Noch keine Trainingspläne vorhanden.</p>
            )}

            {sortedPlans.map((plan, index) => (
              <div key={plan.id} className="list-item plan-card">
                <div className="list-item-header">
                  <div>
                    <h3>
                      {index + 1}. {plan.name}
                    </h3>

                    {plan.description && <p>{plan.description}</p>}

                    <p>
                      Übungen: <strong>{getPlanExerciseNames(plan.id)}</strong>
                    </p>
                  </div>

                  <div className="plan-menu-wrapper">
                    <button
                      className="icon-button"
                      onClick={() => togglePlanMenu(plan.id)}
                      aria-label="Plan Optionen öffnen"
                    >
                      ⋮
                    </button>

                    {openMenuPlanId === plan.id && (
                      <div className="plan-options-menu">
                        <button
                          className="menu-button"
                          onClick={() => {
                            movePlanUp(plan);
                            closePlanMenu();
                          }}
                          disabled={index === 0}
                        >
                          ↑ Hoch
                        </button>

                        <button
                          className="menu-button"
                          onClick={() => {
                            movePlanDown(plan);
                            closePlanMenu();
                          }}
                          disabled={index === sortedPlans.length - 1}
                        >
                          ↓ Runter
                        </button>

                        <button
                          className="menu-button"
                          onClick={() => {
                            openPlanDetailModal(plan.id!);
                            closePlanMenu();
                          }}
                        >
                          Übungen
                        </button>

                        <button
                          className="menu-button"
                          onClick={() => startEditPlan(plan)}
                        >
                          Bearbeiten
                        </button>

                        <button
                          className="menu-button danger-menu-button"
                          onClick={() => deletePlan(plan)}
                        >
                          Löschen
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {showPlanModal && (
            <div className="modal-overlay">
              <div className="modal-card">
                <div className="modal-header">
                  <div>
                    <h3>
                      {editingPlanId
                        ? "Trainingsplan bearbeiten"
                        : "Plan hinzufügen"}
                    </h3>
                    <p>Name und Beschreibung festlegen.</p>
                  </div>

                  <button
                    className="secondary-button small-button"
                    onClick={closePlanModal}
                  >
                    Schließen
                  </button>
                </div>

                <div className="form-block">
                  <input
                    value={planName}
                    onChange={(event) => setPlanName(event.target.value)}
                    placeholder="Name, z. B. Pull & Finger"
                  />

                  <textarea
                    value={planDescription}
                    onChange={(event) => setPlanDescription(event.target.value)}
                    placeholder="Beschreibung optional"
                    rows={2}
                  />

                  <button onClick={savePlan}>
                    {editingPlanId ? "Plan speichern" : "Plan anlegen"}
                  </button>

                  <button className="secondary-button" onClick={closePlanModal}>
                    Abbrechen
                  </button>
                </div>
              </div>
            </div>
          )}

          {showPlanDetailModal && selectedPlan && (
            <div className="modal-overlay">
              <div className="modal-card">
                <div className="modal-header">
                  <div>
                    <h3>Übungen im Plan: {selectedPlan.name}</h3>
                    <p>
                      Erst Körperteil auswählen, dann die passende Übung
                      hinzufügen.
                    </p>
                  </div>

                  <button
                    className="secondary-button small-button"
                    onClick={closePlanDetailModal}
                  >
                    Schließen
                  </button>
                </div>

                <div className="sub-card inner">
                  <h3>Übung hinzufügen</h3>

                  {activeExercises.length === 0 ? (
                    <p>Bitte zuerst aktive Übungen im Tab „Übungen“ anlegen.</p>
                  ) : (
                    <div className="form-block compact">
                      <select
                        value={exerciseBodyPartFilter}
                        onChange={(event) => {
                          setExerciseBodyPartFilter(
                            event.target.value as BodyPart
                          );
                          resetDefaultValues();
                        }}
                      >
                        <option value="">Körperteil auswählen</option>
                        {bodyParts.map((bodyPart) => (
                          <option key={bodyPart} value={bodyPart}>
                            {bodyPart}
                          </option>
                        ))}
                      </select>

                      <select
                        value={selectedExerciseId}
                        disabled={!exerciseBodyPartFilter}
                        onChange={(event) =>
                          prefillFromExercise(
                            event.target.value ? Number(event.target.value) : ""
                          )
                        }
                      >
                        <option value="">Übung auswählen</option>
                        {filteredPlanExercises.map((exercise) => (
                          <option key={exercise.id} value={exercise.id}>
                            {exercise.name} · {formatExerciseType(exercise.type)}
                          </option>
                        ))}
                      </select>

                      {selectedExercise && selectedExercise.type !== "boulder" && (
                        <p className="hint">
                          Zielwerte aus der Übung wurden vorausgefüllt. Du
                          kannst sie für diesen Plan ändern.
                        </p>
                      )}

                      {selectedExercise?.type === "boulder" && (
                        <p className="hint">
                          Boulder-Details wie Style, Grad und Versuche werden
                          später in der Session eingetragen.
                        </p>
                      )}

                      {selectedExercise && selectedExercise.type !== "boulder" && (
                        <>
                          <input
                            type="number"
                            min="0"
                            value={defaultSets}
                            onChange={(event) =>
                              setDefaultSets(event.target.value)
                            }
                            placeholder="Standard-Sätze"
                          />

                          {selectedExercise.type === "reps" && (
                            <input
                              type="number"
                              min="0"
                              value={defaultReps}
                              onChange={(event) =>
                                setDefaultReps(event.target.value)
                              }
                              placeholder="Standard-Wiederholungen"
                            />
                          )}

                          {selectedExercise.type === "time" && (
                            <input
                              type="number"
                              min="0"
                              value={defaultTimeSeconds}
                              onChange={(event) =>
                                setDefaultTimeSeconds(event.target.value)
                              }
                              placeholder="Standard-Zeit in Sekunden"
                            />
                          )}

                          <input
                            type="number"
                            value={defaultWeightKg}
                            onChange={(event) =>
                              setDefaultWeightKg(event.target.value)
                            }
                            placeholder="Standard-Zusatzgewicht kg"
                          />
                        </>
                      )}

                      <textarea
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder={
                          selectedExercise?.type === "boulder"
                            ? "Notiz zum Boulder im Plan optional"
                            : "Notiz optional"
                        }
                        rows={2}
                      />

                      <button onClick={addExerciseToPlan}>
                        Übung zum Plan hinzufügen
                      </button>
                    </div>
                  )}
                </div>

                <div className="list">
                  {selectedPlanExercises.length === 0 && (
                    <p>Dieser Plan enthält noch keine Übungen.</p>
                  )}

                  {selectedPlanExercises.map((item, index) => {
                    const exercise = exerciseMap.get(item.exerciseId);

                    return (
                      <div key={item.id} className="list-item">
                        <h3>
                          {index + 1}. {exercise?.name ?? "Unbekannte Übung"}
                        </h3>

                        <p>{formatPlanExercise(item, exercise)}</p>

                        {item.notes && <p>Notiz: {item.notes}</p>}

                        <div className="action-row">
                          <button
                            className="secondary-button"
                            onClick={() => movePlanExerciseUp(item)}
                            disabled={index === 0}
                          >
                            ↑ Hoch
                          </button>

                          <button
                            className="secondary-button"
                            onClick={() => movePlanExerciseDown(item)}
                            disabled={index === selectedPlanExercises.length - 1}
                          >
                            ↓ Runter
                          </button>

                          <button
                            className="danger-button"
                            onClick={() => removeExerciseFromPlan(item)}
                          >
                            Entfernen
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {trainingTab === "exercises" && <ExercisesPage embedded />}
    </section>
  );
}

function formatPlanExercise(
  item: TrainingPlanExercise,
  exercise?: Exercise
): string {
  if (!exercise) return "Keine Übungsdaten";

  if (exercise.type === "boulder") {
    return "Boulder-Details werden in der Session erfasst.";
  }

  if (exercise.type === "reps") {
    return `${item.defaultSets ?? "-"} Sätze × ${
      item.defaultReps ?? "-"
    } Wdh. · ${item.defaultWeightKg ?? 0} kg`;
  }

  return `${item.defaultSets ?? "-"} Sätze × ${
    item.defaultTimeSeconds ?? "-"
  } sek · ${item.defaultWeightKg ?? 0} kg`;
}