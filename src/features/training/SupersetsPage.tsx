import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { db } from "../../db/db";

import type {
  Exercise,
  ExerciseCategory,
  Superset,
  SupersetExercise,
} from "../../db/types";

function formatCategory(
  category: ExerciseCategory | undefined
) {
  if (category === "mobility") {
    return "Beweglichkeit";
  }

  if (category === "boulder") {
    return "Bouldern";
  }

  return "Kraft";
}

function formatExerciseType(exercise: Exercise) {
  if (exercise.type === "reps") {
    return "Wiederholungen";
  }

  if (exercise.type === "time") {
    return "Zeit";
  }

  return "Bouldern";
}

export default function SupersetsPage() {
  const [supersets, setSupersets] = useState<
    Superset[]
  >([]);

  const [
    supersetExercises,
    setSupersetExercises,
  ] = useState<SupersetExercise[]>([]);

  const [exercises, setExercises] = useState<
    Exercise[]
  >([]);

  const [
    showSupersetModal,
    setShowSupersetModal,
  ] = useState(false);

  const [
    showDetailModal,
    setShowDetailModal,
  ] = useState(false);

  const [
    editingSupersetId,
    setEditingSupersetId,
  ] = useState<number | null>(null);

  const [
    selectedSupersetId,
    setSelectedSupersetId,
  ] = useState<number | null>(null);

  const [
    openMenuSupersetId,
    setOpenMenuSupersetId,
  ] = useState<number | null>(null);

  const [showInactive, setShowInactive] =
    useState(false);

  const [supersetName, setSupersetName] =
    useState("");

  const [supersetRounds, setSupersetRounds] =
    useState("3");

  const [supersetNotes, setSupersetNotes] =
    useState("");

  const [
    exerciseCategory,
    setExerciseCategory,
  ] = useState<ExerciseCategory | "">("");

  const [
    selectedExerciseId,
    setSelectedExerciseId,
  ] = useState<number | "">("");

  const [defaultReps, setDefaultReps] =
    useState("");

  const [
    defaultTimeSeconds,
    setDefaultTimeSeconds,
  ] = useState("");

  const [defaultWeightKg, setDefaultWeightKg] =
    useState("");

  const [exerciseNotes, setExerciseNotes] =
    useState("");

  async function loadData() {
    const supersetData =
      await db.supersets.toArray();

    const supersetExerciseData =
      await db.supersetExercises.toArray();

    const exerciseData =
      await db.exercises.toArray();

    setSupersets(supersetData);

    setSupersetExercises(
      supersetExerciseData
    );

    setExercises(exerciseData);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    function handleOpenSupersetModal() {
      resetSupersetForm();
      setShowSupersetModal(true);
    }

    window.addEventListener(
      "openSupersetModal",
      handleOpenSupersetModal
    );

    return () => {
      window.removeEventListener(
        "openSupersetModal",
        handleOpenSupersetModal
      );
    };
  }, []);

  const activeExercises = useMemo(() => {
    return exercises
      .filter((exercise) => exercise.isActive)
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );
  }, [exercises]);

  const exerciseMap = useMemo(() => {
    return new Map(
      exercises
        .filter(
          (exercise) =>
            exercise.id !== undefined
        )
        .map((exercise) => [
          exercise.id!,
          exercise,
        ])
    );
  }, [exercises]);

  const filteredSupersets = useMemo(() => {
    return supersets
      .filter(
        (superset) =>
          showInactive || superset.isActive
      )
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );
  }, [supersets, showInactive]);

  const selectedSuperset = useMemo(() => {
    if (!selectedSupersetId) {
      return null;
    }

    return (
      supersets.find(
        (superset) =>
          superset.id === selectedSupersetId
      ) ?? null
    );
  }, [supersets, selectedSupersetId]);

  const selectedSupersetExercises =
    useMemo(() => {
      if (!selectedSupersetId) {
        return [];
      }

      return supersetExercises
        .filter(
          (item) =>
            item.supersetId ===
            selectedSupersetId
        )
        .sort(
          (a, b) =>
            a.position - b.position
        );
    }, [
      supersetExercises,
      selectedSupersetId,
    ]);

  const filteredExercises = useMemo(() => {
    if (!exerciseCategory) {
      return [];
    }

    return activeExercises.filter(
      (exercise) =>
        exercise.category ===
          exerciseCategory &&
        exercise.type !== "boulder"
    );
  }, [activeExercises, exerciseCategory]);

  const selectedExercise = useMemo(() => {
    if (!selectedExerciseId) {
      return null;
    }

    return (
      exerciseMap.get(selectedExerciseId) ??
      null
    );
  }, [selectedExerciseId, exerciseMap]);

  function getExerciseNames(
    supersetId?: number
  ) {
    if (!supersetId) {
      return "Keine Übungen";
    }

    const names = supersetExercises
      .filter(
        (item) =>
          item.supersetId === supersetId
      )
      .sort(
        (a, b) =>
          a.position - b.position
      )
      .map(
        (item) =>
          exerciseMap.get(item.exerciseId)
            ?.name
      )
      .filter(
        (name): name is string =>
          Boolean(name)
      );

    return names.length > 0
      ? names.join(" · ")
      : "Keine Übungen";
  }

  function resetSupersetForm() {
    setEditingSupersetId(null);
    setSupersetName("");
    setSupersetRounds("3");
    setSupersetNotes("");
  }

  function resetExerciseForm() {
    setExerciseCategory("");
    setSelectedExerciseId("");
    setDefaultReps("");
    setDefaultTimeSeconds("");
    setDefaultWeightKg("");
    setExerciseNotes("");
  }

  function closeSupersetModal() {
    resetSupersetForm();
    setShowSupersetModal(false);
  }

  function openDetailModal(
    supersetId: number
  ) {
    setSelectedSupersetId(supersetId);
    resetExerciseForm();
    setShowDetailModal(true);
    setOpenMenuSupersetId(null);
  }

  function closeDetailModal() {
    resetExerciseForm();
    setShowDetailModal(false);
    setSelectedSupersetId(null);
  }

  function toggleMenu(
    supersetId?: number
  ) {
    if (!supersetId) {
      return;
    }

    setOpenMenuSupersetId((current) =>
      current === supersetId
        ? null
        : supersetId
    );
  }

  async function saveSuperset() {
    const trimmedName =
      supersetName.trim();

    const rounds = Number(
      supersetRounds
    );

    if (!trimmedName) {
      alert(
        "Bitte einen Namen für den Supersatz eingeben."
      );

      return;
    }

    if (
      !Number.isInteger(rounds) ||
      rounds < 1
    ) {
      alert(
        "Bitte eine gültige Anzahl Durchgänge ab 1 eingeben."
      );

      return;
    }

    const now = new Date().toISOString();
    const isEditing =
      editingSupersetId !== null;

    if (editingSupersetId !== null) {
      await db.supersets.update(
        editingSupersetId,
        {
          name: trimmedName,
          rounds,
          notes:
            supersetNotes.trim() ||
            undefined,
          updatedAt: now,
        }
      );

      setSelectedSupersetId(
        editingSupersetId
      );
    } else {
      const newSupersetId =
        await db.supersets.add({
          name: trimmedName,
          rounds,
          isActive: true,
          notes:
            supersetNotes.trim() ||
            undefined,
          createdAt: now,
          updatedAt: now,
        });

      setSelectedSupersetId(
        newSupersetId
      );
    }

    setShowSupersetModal(false);
    resetSupersetForm();

    await loadData();

    if (!isEditing) {
      resetExerciseForm();
      setShowDetailModal(true);
    }
  }

  function startEditSuperset(
    superset: Superset
  ) {
    if (!superset.id) {
      return;
    }

    setEditingSupersetId(superset.id);
    setSupersetName(superset.name);

    setSupersetRounds(
      superset.rounds.toString()
    );

    setSupersetNotes(
      superset.notes ?? ""
    );

    setOpenMenuSupersetId(null);
    setShowSupersetModal(true);
  }

  async function toggleSupersetActive(
    superset: Superset
  ) {
    if (!superset.id) {
      return;
    }

    await db.supersets.update(
      superset.id,
      {
        isActive: !superset.isActive,
        updatedAt:
          new Date().toISOString(),
      }
    );

    setOpenMenuSupersetId(null);
    await loadData();
  }

  async function deleteSuperset(
    superset: Superset
  ) {
    if (!superset.id) {
      return;
    }

    const confirmed = window.confirm(
      `Supersatz "${superset.name}" wirklich löschen?`
    );

    if (!confirmed) {
      return;
    }

    await db.transaction(
      "rw",
      db.supersets,
      db.supersetExercises,
      async () => {
        await db.supersetExercises
          .where("supersetId")
          .equals(superset.id!)
          .delete();

        await db.supersets.delete(
          superset.id!
        );
      }
    );

    if (
      selectedSupersetId === superset.id
    ) {
      setSelectedSupersetId(null);
      setShowDetailModal(false);
    }

    setOpenMenuSupersetId(null);

    await loadData();
  }

  function selectExercise(
    exerciseIdValue: number | ""
  ) {
    setSelectedExerciseId(
      exerciseIdValue
    );

    if (!exerciseIdValue) {
      setDefaultReps("");
      setDefaultTimeSeconds("");
      setDefaultWeightKg("");
      setExerciseNotes("");
      return;
    }

    const exercise = exerciseMap.get(
      exerciseIdValue
    );

    if (!exercise) {
      return;
    }

    if (exercise.type === "reps") {
      setDefaultReps(
        exercise.targetReps?.toString() ??
          ""
      );

      setDefaultTimeSeconds("");
    } else if (exercise.type === "time") {
      setDefaultTimeSeconds(
        exercise.targetTimeSeconds?.toString() ??
          ""
      );

      setDefaultReps("");
    }

    setDefaultWeightKg("");
    setExerciseNotes("");
  }

  async function addExerciseToSuperset() {
    if (!selectedSupersetId) {
      alert(
        "Bitte zuerst einen Supersatz auswählen."
      );

      return;
    }

    if (!selectedExerciseId) {
      alert(
        "Bitte eine Übung auswählen."
      );

      return;
    }

    const exercise = exerciseMap.get(
      selectedExerciseId
    );

    if (!exercise) {
      alert(
        "Die ausgewählte Übung wurde nicht gefunden."
      );

      return;
    }

    if (exercise.type === "boulder") {
      alert(
        "Boulder-Übungen können nicht zu einem Supersatz hinzugefügt werden."
      );

      return;
    }

    if (
      exercise.type === "reps" &&
      !defaultReps.trim()
    ) {
      alert(
        "Bitte Standard-Wiederholungen eintragen."
      );

      return;
    }

    if (
      exercise.type === "time" &&
      !defaultTimeSeconds.trim()
    ) {
      alert(
        "Bitte eine Standard-Zeit eintragen."
      );

      return;
    }

    const parsedWeight = defaultWeightKg.trim()
      ? Number(defaultWeightKg)
      : 0;

    if (!Number.isFinite(parsedWeight)) {
      alert(
        "Bitte ein gültiges Standardgewicht eingeben."
      );

      return;
    }

    const alreadyIncluded =
      selectedSupersetExercises.some(
        (item) =>
          item.exerciseId ===
          selectedExerciseId
      );

    if (alreadyIncluded) {
      alert(
        "Diese Übung ist bereits im Supersatz enthalten."
      );

      return;
    }

    const nextPosition =
      selectedSupersetExercises.length === 0
        ? 1
        : Math.max(
            ...selectedSupersetExercises.map(
              (item) => item.position
            )
          ) + 1;

    await db.supersetExercises.add({
      supersetId: selectedSupersetId,
      exerciseId: selectedExerciseId,
      position: nextPosition,

      defaultReps:
        exercise.type === "reps"
          ? Number(defaultReps)
          : undefined,

      defaultTimeSeconds:
        exercise.type === "time"
          ? Number(defaultTimeSeconds)
          : undefined,

      defaultWeightKg: parsedWeight,

      notes:
        exerciseNotes.trim() ||
        undefined,
    });

    resetExerciseForm();
    await loadData();
  }

  async function removeExercise(
    item: SupersetExercise
  ) {
    if (!item.id) {
      return;
    }

    const exercise = exerciseMap.get(
      item.exerciseId
    );

    const confirmed = window.confirm(
      `Übung "${
        exercise?.name ??
        "Unbekannte Übung"
      }" aus dem Supersatz entfernen?`
    );

    if (!confirmed) {
      return;
    }

    await db.supersetExercises.delete(
      item.id
    );

    await normalizePositions();
    await loadData();
  }

  async function normalizePositions() {
    if (!selectedSupersetId) {
      return;
    }

    const items =
      await db.supersetExercises
        .where("supersetId")
        .equals(selectedSupersetId)
        .sortBy("position");

    await db.transaction(
      "rw",
      db.supersetExercises,
      async () => {
        for (
          let index = 0;
          index < items.length;
          index += 1
        ) {
          const item = items[index];

          if (!item.id) {
            continue;
          }

          await db.supersetExercises.update(
            item.id,
            {
              position: index + 1,
            }
          );
        }
      }
    );
  }

  async function moveExerciseUp(
    item: SupersetExercise
  ) {
    if (!item.id) {
      return;
    }

    const currentIndex =
      selectedSupersetExercises.findIndex(
        (candidate) =>
          candidate.id === item.id
      );

    if (currentIndex <= 0) {
      return;
    }

    const previousItem =
      selectedSupersetExercises[
        currentIndex - 1
      ];

    if (!previousItem.id) {
      return;
    }

    await db.transaction(
      "rw",
      db.supersetExercises,
      async () => {
        await db.supersetExercises.update(
          item.id!,
          {
            position:
              previousItem.position,
          }
        );

        await db.supersetExercises.update(
          previousItem.id!,
          {
            position: item.position,
          }
        );
      }
    );

    await loadData();
  }

  async function moveExerciseDown(
    item: SupersetExercise
  ) {
    if (!item.id) {
      return;
    }

    const currentIndex =
      selectedSupersetExercises.findIndex(
        (candidate) =>
          candidate.id === item.id
      );

    if (
      currentIndex < 0 ||
      currentIndex >=
        selectedSupersetExercises.length - 1
    ) {
      return;
    }

    const nextItem =
      selectedSupersetExercises[
        currentIndex + 1
      ];

    if (!nextItem.id) {
      return;
    }

    await db.transaction(
      "rw",
      db.supersetExercises,
      async () => {
        await db.supersetExercises.update(
          item.id!,
          {
            position: nextItem.position,
          }
        );

        await db.supersetExercises.update(
          nextItem.id!,
          {
            position: item.position,
          }
        );
      }
    );

    await loadData();
  }

  function finishSuperset() {
    if (
      selectedSupersetExercises.length === 0
    ) {
      alert(
        "Bitte mindestens eine Übung zum Supersatz hinzufügen."
      );

      return;
    }

    closeDetailModal();
  }

  return (
    <>
      <label className="inline-toggle">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(event) =>
            setShowInactive(
              event.target.checked
            )
          }
        />

        Passive Supersätze anzeigen
      </label>

      <div className="list">
        {filteredSupersets.length === 0 && (
          <p>
            {showInactive
              ? "Noch keine Supersätze vorhanden."
              : "Noch keine aktiven Supersätze vorhanden."}
          </p>
        )}

        {filteredSupersets.map(
          (superset) => (
            <div
              key={superset.id}
              className="list-item plan-card"
            >
              <div className="list-item-header">
                <div>
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
                    Status:{" "}
                    <span
                      className={
                        superset.isActive
                          ? "status active"
                          : "status inactive"
                      }
                    >
                      {superset.isActive
                        ? "Aktiv"
                        : "Passiv"}
                    </span>
                  </p>

                  <p>
                    Übungen:{" "}
                    <strong>
                      {getExerciseNames(
                        superset.id
                      )}
                    </strong>
                  </p>

                  {superset.notes && (
                    <p>
                      Notiz:{" "}
                      {superset.notes}
                    </p>
                  )}
                </div>

                <div className="plan-menu-wrapper">
                  <button
                    className="icon-button"
                    onClick={() =>
                      toggleMenu(
                        superset.id
                      )
                    }
                    aria-label="Supersatz Optionen öffnen"
                  >
                    ⋮
                  </button>

                  {openMenuSupersetId ===
                    superset.id && (
                    <div className="plan-options-menu">
                      <button
                        className="menu-button"
                        onClick={() =>
                          openDetailModal(
                            superset.id!
                          )
                        }
                      >
                        Übungen
                      </button>

                      <button
                        className="menu-button"
                        onClick={() =>
                          startEditSuperset(
                            superset
                          )
                        }
                      >
                        Bearbeiten
                      </button>

                      <button
                        className="menu-button"
                        onClick={() =>
                          toggleSupersetActive(
                            superset
                          )
                        }
                      >
                        {superset.isActive
                          ? "Deaktivieren"
                          : "Aktivieren"}
                      </button>

                      <button
                        className="menu-button danger-menu-button"
                        onClick={() =>
                          deleteSuperset(
                            superset
                          )
                        }
                      >
                        Löschen
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {showSupersetModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>
                  {editingSupersetId
                    ? "Supersatz bearbeiten"
                    : "Supersatz hinzufügen"}
                </h3>

                <p>
                  Name und Anzahl der
                  Durchgänge festlegen.
                </p>
              </div>

              <button
                className="secondary-button small-button"
                onClick={
                  closeSupersetModal
                }
              >
                Schließen
              </button>
            </div>

            <div className="form-block">
              <label className="field-label">
                Name
              </label>

              <input
                value={supersetName}
                onChange={(event) =>
                  setSupersetName(
                    event.target.value
                  )
                }
                placeholder="z. B. Oberkörper"
              />

              <label className="field-label">
                Anzahl Durchgänge
              </label>

              <input
                type="number"
                min="1"
                step="1"
                value={supersetRounds}
                onChange={(event) =>
                  setSupersetRounds(
                    event.target.value
                  )
                }
                placeholder="3"
              />

              <textarea
                value={supersetNotes}
                onChange={(event) =>
                  setSupersetNotes(
                    event.target.value
                  )
                }
                placeholder="Notiz optional"
                rows={2}
              />

              <button
                onClick={saveSuperset}
              >
                {editingSupersetId
                  ? "Supersatz speichern"
                  : "Weiter zu Übungen"}
              </button>

              <button
                className="secondary-button"
                onClick={
                  closeSupersetModal
                }
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal &&
        selectedSuperset && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <div>
                  <h3>
                    {selectedSuperset.name}
                  </h3>

                  <p>
                    {
                      selectedSuperset.rounds
                    }{" "}
                    {selectedSuperset.rounds ===
                    1
                      ? "Durchgang"
                      : "Durchgänge"}
                  </p>
                </div>

                <button
                  className="secondary-button small-button"
                  onClick={
                    closeDetailModal
                  }
                >
                  Schließen
                </button>
              </div>

              <div className="sub-card inner">
                <h3>
                  Übung hinzufügen
                </h3>

                <div className="form-block compact">
                  <label className="field-label">
                    Kategorie
                  </label>

                  <select
                    value={
                      exerciseCategory
                    }
                    onChange={(event) => {
                      setExerciseCategory(
                        event.target
                          .value as
                          | ExerciseCategory
                          | ""
                      );

                      setSelectedExerciseId(
                        ""
                      );

                      setDefaultReps("");
                      setDefaultTimeSeconds(
                        ""
                      );
                      setDefaultWeightKg("");
                      setExerciseNotes("");
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
                  </select>

                  <label className="field-label">
                    Übung
                  </label>

                  <select
                    value={
                      selectedExerciseId
                    }
                    disabled={
                      !exerciseCategory
                    }
                    onChange={(event) =>
                      selectExercise(
                        event.target.value
                          ? Number(
                              event.target
                                .value
                            )
                          : ""
                      )
                    }
                  >
                    <option value="">
                      Übung auswählen
                    </option>

                    {filteredExercises.map(
                      (exercise) => (
                        <option
                          key={exercise.id}
                          value={exercise.id}
                        >
                          {exercise.name} ·{" "}
                          {formatExerciseType(
                            exercise
                          )}
                        </option>
                      )
                    )}
                  </select>

                  {selectedExercise?.type ===
                    "reps" && (
                    <>
                      <label className="field-label">
                        Wiederholungen pro
                        Durchgang
                      </label>

                      <input
                        type="number"
                        min="0"
                        value={defaultReps}
                        onChange={(event) =>
                          setDefaultReps(
                            event.target
                              .value
                          )
                        }
                        placeholder="z. B. 8"
                      />
                    </>
                  )}

                  {selectedExercise?.type ===
                    "time" && (
                    <>
                      <label className="field-label">
                        Zeit pro Durchgang
                      </label>

                      <div className="input-with-unit">
                        <input
                          type="number"
                          min="0"
                          value={
                            defaultTimeSeconds
                          }
                          onChange={(
                            event
                          ) =>
                            setDefaultTimeSeconds(
                              event.target
                                .value
                            )
                          }
                          placeholder="z. B. 45"
                        />

                        <span>sek</span>
                      </div>
                    </>
                  )}

                  {selectedExercise && (
                    <>
                      <label className="field-label">
                        Standardgewicht
                      </label>

                      <div className="input-with-unit">
                        <input
                          type="number"
                          value={
                            defaultWeightKg
                          }
                          onChange={(
                            event
                          ) =>
                            setDefaultWeightKg(
                              event.target
                                .value
                            )
                          }
                          placeholder="0"
                        />

                        <span>kg</span>
                      </div>

                      <textarea
                        value={
                          exerciseNotes
                        }
                        onChange={(event) =>
                          setExerciseNotes(
                            event.target
                              .value
                          )
                        }
                        placeholder="Notiz zur Übung optional"
                        rows={2}
                      />

                      <button
                        onClick={
                          addExerciseToSuperset
                        }
                      >
                        Übung hinzufügen
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="list">
                {selectedSupersetExercises.length ===
                  0 && (
                  <p>
                    Dieser Supersatz enthält
                    noch keine Übungen.
                  </p>
                )}

                {selectedSupersetExercises.map(
                  (item, index) => {
                    const exercise =
                      exerciseMap.get(
                        item.exerciseId
                      );

                    return (
                      <div
                        key={item.id}
                        className="list-item"
                      >
                        <h3>
                          {index + 1}.{" "}
                          {exercise?.name ??
                            "Unbekannte Übung"}
                        </h3>

                        {exercise && (
                          <p>
                            {formatCategory(
                              exercise.category
                            )}{" "}
                            ·{" "}
                            {exercise.type ===
                            "reps"
                              ? `${
                                  item.defaultReps ??
                                  "-"
                                } Wdh. · ${
                                  item.defaultWeightKg ??
                                  0
                                } kg`
                              : `${
                                  item.defaultTimeSeconds ??
                                  "-"
                                } sek · ${
                                  item.defaultWeightKg ??
                                  0
                                } kg`}
                          </p>
                        )}

                        {item.notes && (
                          <p>
                            Notiz:{" "}
                            {item.notes}
                          </p>
                        )}

                        <div className="action-row">
                          <button
                            className="secondary-button"
                            onClick={() =>
                              moveExerciseUp(
                                item
                              )
                            }
                            disabled={
                              index === 0
                            }
                          >
                            ↑ Hoch
                          </button>

                          <button
                            className="secondary-button"
                            onClick={() =>
                              moveExerciseDown(
                                item
                              )
                            }
                            disabled={
                              index ===
                              selectedSupersetExercises.length -
                                1
                            }
                          >
                            ↓ Runter
                          </button>

                          <button
                            className="danger-button"
                            onClick={() =>
                              removeExercise(
                                item
                              )
                            }
                          >
                            Entfernen
                          </button>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              <div className="session-action-row">
                <button
                  onClick={finishSuperset}
                  disabled={
                    selectedSupersetExercises.length ===
                    0
                  }
                >
                  Supersatz anlegen
                </button>

                <button
                  className="secondary-button"
                  onClick={
                    closeDetailModal
                  }
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}