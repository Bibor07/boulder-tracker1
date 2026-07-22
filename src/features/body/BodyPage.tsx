import { useEffect, useMemo, useState } from "react";
import { db } from "../../db/db";
import type { BodyMeasurement, Sex } from "../../db/types";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function calculateBmi(weightKg: number, heightCm: number) {
  const heightM = heightCm / 100;
  return roundOne(weightKg / (heightM * heightM));
}

function calculateNavyMaleCm(
  heightCm: number,
  waistCm: number,
  neckCm: number
) {
  if (waistCm <= neckCm) {
    throw new Error("Bei Männern muss Taille größer als Nacken sein.");
  }

  const result =
    495 /
      (1.0324 -
        0.19077 * Math.log10(waistCm - neckCm) +
        0.15456 * Math.log10(heightCm)) -
    450;

  return roundOne(result);
}

function calculateNavyFemaleCm(
  heightCm: number,
  waistCm: number,
  neckCm: number,
  hipCm: number
) {
  if (waistCm + hipCm <= neckCm) {
    throw new Error("Bei Frauen muss Taille + Hüfte größer als Nacken sein.");
  }

  const result =
    495 /
      (1.29579 -
        0.35004 * Math.log10(waistCm + hipCm - neckCm) +
        0.221 * Math.log10(heightCm)) -
    450;

  return roundOne(result);
}

function calculateDeurenberg(
  bmi: number,
  age: number,
  sex: Sex
) {
  const sexValue = sex === "male" ? 1 : 0;
  const result = 1.2 * bmi + 0.23 * age - 10.8 * sexValue - 5.4;

  return roundOne(result);
}

function calculateFinalBodyFat(navy: number, deurenberg: number) {
  return roundOne(navy * 0.8 + deurenberg * 0.2);
}

export default function BodyPage() {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [date, setDate] = useState(todayIsoDate());
  const [sex, setSex] = useState<Sex>("male");
  const [age, setAge] = useState("");

  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [neckCm, setNeckCm] = useState("");
  const [hipCm, setHipCm] = useState("");

  const [notes, setNotes] = useState("");

  async function loadData() {
    const data = await db.bodyMeasurements.toArray();
    setMeasurements(data);
  }

  useEffect(() => {
    loadData();
  }, []);

  const sortedMeasurements = useMemo(() => {
    return [...measurements].sort((a, b) => b.date.localeCompare(a.date));
  }, [measurements]);

  const latestMeasurement = sortedMeasurements[0] ?? null;
  const previousMeasurement = sortedMeasurements[1] ?? null;

  function resetForm() {
    setEditingId(null);
    setDate(todayIsoDate());
    setSex("male");
    setAge("");
    setWeightKg("");
    setHeightCm("");
    setWaistCm("");
    setNeckCm("");
    setHipCm("");
    setNotes("");
  }

  function openNewModal() {
    resetForm();
    setShowModal(true);
  }

  function closeModal() {
    resetForm();
    setShowModal(false);
  }

  function toggleMenu(id?: number) {
    if (!id) return;
    setOpenMenuId((current) => (current === id ? null : id));
  }

  function closeMenu() {
    setOpenMenuId(null);
  }

  function startEdit(item: BodyMeasurement) {
    setEditingId(item.id ?? null);
    setDate(item.date);
    setSex(item.sex);
    setAge(item.age.toString());
    setWeightKg(item.weightKg.toString());
    setHeightCm(item.heightCm.toString());
    setWaistCm(item.waistCm.toString());
    setNeckCm(item.neckCm.toString());
    setHipCm(item.hipCm?.toString() ?? "");
    setNotes(item.notes ?? "");

    closeMenu();
    setShowModal(true);
  }

  function calculatePreview() {
    const parsedAge = Number(age);
    const parsedWeight = Number(weightKg);
    const parsedHeight = Number(heightCm);
    const parsedWaist = Number(waistCm);
    const parsedNeck = Number(neckCm);
    const parsedHip = Number(hipCm);

    if (
      !parsedAge ||
      !parsedWeight ||
      !parsedHeight ||
      !parsedWaist ||
      !parsedNeck
    ) {
      return null;
    }

    if (sex === "female" && !parsedHip) {
      return null;
    }

    const bmi = calculateBmi(parsedWeight, parsedHeight);

    const navy =
      sex === "male"
        ? calculateNavyMaleCm(parsedHeight, parsedWaist, parsedNeck)
        : calculateNavyFemaleCm(
            parsedHeight,
            parsedWaist,
            parsedNeck,
            parsedHip
          );

    const deurenberg = calculateDeurenberg(bmi, parsedAge, sex);
    const final = calculateFinalBodyFat(navy, deurenberg);

    return {
      bmi,
      navy,
      deurenberg,
      final,
    };
  }

  async function saveMeasurement() {
    const parsedAge = Number(age);
    const parsedWeight = Number(weightKg);
    const parsedHeight = Number(heightCm);
    const parsedWaist = Number(waistCm);
    const parsedNeck = Number(neckCm);
    const parsedHip = Number(hipCm);

    if (!parsedAge || parsedAge <= 0) {
      alert("Bitte Alter eingeben.");
      return;
    }

    if (!parsedWeight || parsedWeight <= 0) {
      alert("Bitte Gewicht eingeben.");
      return;
    }

    if (!parsedHeight || parsedHeight <= 0) {
      alert("Bitte Größe eingeben.");
      return;
    }

    if (!parsedWaist || parsedWaist <= 0) {
      alert("Bitte Taille eingeben.");
      return;
    }

    if (!parsedNeck || parsedNeck <= 0) {
      alert("Bitte Nacken eingeben.");
      return;
    }

    if (sex === "female" && (!parsedHip || parsedHip <= 0)) {
      alert("Bei Frau bitte Hüfte eingeben.");
      return;
    }

    let calculated;

    try {
      calculated = calculatePreview();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Berechnung fehlgeschlagen.");
      return;
    }

    if (!calculated) {
      alert("Bitte alle benötigten Felder ausfüllen.");
      return;
    }

    const now = new Date().toISOString();

    const measurementData = {
      date,
      sex,
      age: parsedAge,
      weightKg: parsedWeight,
      heightCm: parsedHeight,
      waistCm: parsedWaist,
      neckCm: parsedNeck,
      hipCm: sex === "female" ? parsedHip : undefined,
      bmi: calculated.bmi,
      bodyFatNavyPercent: calculated.navy,
      bodyFatDeurenbergPercent: calculated.deurenberg,
      bodyFatPercent: calculated.final,
      notes: notes.trim() || undefined,
      updatedAt: now,
    };

    if (editingId !== null) {
      await db.bodyMeasurements.update(editingId, measurementData);
    } else {
      await db.bodyMeasurements.add({
        ...measurementData,
        createdAt: now,
      });
    }

    resetForm();
    setShowModal(false);
    await loadData();
  }

  async function deleteMeasurement(item: BodyMeasurement) {
    if (!item.id) return;

    const confirmed = window.confirm(
      `Körpermessung vom ${item.date} wirklich löschen?`
    );

    if (!confirmed) return;

    await db.bodyMeasurements.delete(item.id);

    if (editingId === item.id) {
      resetForm();
      setShowModal(false);
    }

    closeMenu();
    await loadData();
  }

  const preview = (() => {
    try {
      return calculatePreview();
    } catch {
      return null;
    }
  })();

  return (
    <section className="card">
      <div className="page-header">
        <div>
          <h2>Körper</h2>
          <p>Gewicht, Maße, BMI und KFA verfolgen.</p>
        </div>

        <button className="primary-action-button" onClick={openNewModal}>
          Messung hinzufügen
        </button>
      </div>

      {latestMeasurement && (
        <div className="sub-card">
          <h3>Aktueller Stand</h3>

          <p>
            Gewicht: <strong>{latestMeasurement.weightKg} kg</strong>
          </p>

          <p>
            KFA Final: <strong>{latestMeasurement.bodyFatPercent} %</strong>
          </p>

          <p>
            BMI: <strong>{latestMeasurement.bmi}</strong>
          </p>

          {previousMeasurement && (
            <>
              <p>
                Gewicht Differenz:{" "}
                <strong>
                  {roundOne(
                    latestMeasurement.weightKg - previousMeasurement.weightKg
                  )}{" "}
                  kg
                </strong>
              </p>

              <p>
                KFA Differenz:{" "}
                <strong>
                  {roundOne(
                    latestMeasurement.bodyFatPercent -
                      previousMeasurement.bodyFatPercent
                  )}{" "}
                  %
                </strong>
              </p>
            </>
          )}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h3>{editingId ? "Messung bearbeiten" : "Messung hinzufügen"}</h3>
                <p>Navy + Deurenberg werden berechnet und gemischt.</p>
              </div>

              <button
                className="secondary-button small-button"
                onClick={closeModal}
              >
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

              <label className="field-label">Geschlecht</label>
              <select
                value={sex}
                onChange={(event) => {
                  const nextSex = event.target.value as Sex;
                  setSex(nextSex);

                  if (nextSex === "male") {
                    setHipCm("");
                  }
                }}
              >
                <option value="male">Mann</option>
                <option value="female">Frau</option>
              </select>

              <input
                type="number"
                min="0"
                value={age}
                onChange={(event) => setAge(event.target.value)}
                placeholder="Alter"
              />

              <div className="input-with-unit">
                <input
                  type="number"
                  min="0"
                  value={weightKg}
                  onChange={(event) => setWeightKg(event.target.value)}
                  placeholder="0"
                />
                <span>kg</span>
              </div>

              <div className="input-with-unit">
                <input
                  type="number"
                  min="0"
                  value={heightCm}
                  onChange={(event) => setHeightCm(event.target.value)}
                  placeholder="0"
                />
                <span>cm Größe</span>
              </div>

              <div className="input-with-unit">
                <input
                  type="number"
                  min="0"
                  value={waistCm}
                  onChange={(event) => setWaistCm(event.target.value)}
                  placeholder="0"
                />
                <span>cm Taille</span>
              </div>

              <div className="input-with-unit">
                <input
                  type="number"
                  min="0"
                  value={neckCm}
                  onChange={(event) => setNeckCm(event.target.value)}
                  placeholder="0"
                />
                <span>cm Nacken</span>
              </div>

              {sex === "female" && (
                <div className="input-with-unit">
                  <input
                    type="number"
                    min="0"
                    value={hipCm}
                    onChange={(event) => setHipCm(event.target.value)}
                    placeholder="0"
                  />
                  <span>cm Hüfte</span>
                </div>
              )}

              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Notiz optional"
                rows={2}
              />

              {preview && (
                <div className="last-stats-box">
                  <strong>Vorschau</strong>
                  <p>BMI: {preview.bmi}</p>
                  <p>KFA Navy: {preview.navy} %</p>
                  <p>KFA Deurenberg: {preview.deurenberg} %</p>
                  <p>
                    <strong>KFA Final: {preview.final} %</strong>
                  </p>
                </div>
              )}

              <button onClick={saveMeasurement}>
                {editingId ? "Messung speichern" : "Messung anlegen"}
              </button>

              <button className="secondary-button" onClick={closeModal}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="list">
        {sortedMeasurements.length === 0 && (
          <p>Noch keine Körpermessungen vorhanden.</p>
        )}

        {sortedMeasurements.map((item) => (
          <div key={item.id} className="list-item plan-card">
            <div className="list-item-header">
              <div>
                <h3>{item.date}</h3>
                <p>
                  {item.sex === "male" ? "Mann" : "Frau"} · {item.age} Jahre
                </p>
              </div>

              <div className="plan-menu-wrapper">
                <button
                  className="icon-button"
                  onClick={() => toggleMenu(item.id)}
                  aria-label="Körpermessung Optionen öffnen"
                >
                  ⋮
                </button>

                {openMenuId === item.id && (
                  <div className="plan-options-menu">
                    <button
                      className="menu-button"
                      onClick={() => startEdit(item)}
                    >
                      Bearbeiten
                    </button>

                    <button
                      className="menu-button danger-menu-button"
                      onClick={() => deleteMeasurement(item)}
                    >
                      Löschen
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="details">
              <p>
                Gewicht: <strong>{item.weightKg} kg</strong>
              </p>

              <p>
                Größe: <strong>{item.heightCm} cm</strong>
              </p>

              <p>
                BMI: <strong>{item.bmi}</strong>
              </p>

              <p>
                KFA Final: <strong>{item.bodyFatPercent} %</strong>
              </p>

              <p>
                Navy: {item.bodyFatNavyPercent} % · Deurenberg:{" "}
                {item.bodyFatDeurenbergPercent} %
              </p>

              <p>
                Taille: {item.waistCm} cm · Nacken: {item.neckCm} cm
                {item.sex === "female" && item.hipCm
                  ? ` · Hüfte: ${item.hipCm} cm`
                  : ""}
              </p>

              {item.notes && <p>Notiz: {item.notes}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}