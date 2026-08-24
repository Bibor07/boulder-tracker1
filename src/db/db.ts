import Dexie, { type Table } from "dexie";

import type {
  AppSettings,
  BodyMeasurement,
  DiaryEntry,
  DiaryExercise,
  Exercise,
  Superset,
  SupersetExercise,
  TrainingPlan,
  TrainingPlanExercise,
} from "./types";

export class BoulderTrackerDB extends Dexie {
  exercises!: Table<Exercise, number>;
  trainingPlans!: Table<TrainingPlan, number>;
  trainingPlanExercises!: Table<TrainingPlanExercise, number>;
  diaryEntries!: Table<DiaryEntry, number>;
  diaryExercises!: Table<DiaryExercise, number>;
  bodyMeasurements!: Table<BodyMeasurement, number>;
  settings!: Table<AppSettings, number>;

  supersets!: Table<Superset, number>;
  supersetExercises!: Table<SupersetExercise, number>;

  constructor() {
    super("boulder-tracker-db");

    /*
     * Bestehendes Schema nicht verändern.
     *
     * Diese Definition entspricht der bereits installierten
     * Datenbankversion 1.
     */
    this.version(1).stores({
      exercises: "++id, name, bodyPart, type, isActive",
      trainingPlans: "++id, name",
      trainingPlanExercises: "++id, planId, exerciseId, position",
      diaryEntries: "++id, date",
      diaryExercises: "++id, diaryEntryId, exerciseId",
      bodyMeasurements: "++id, date",
      settings: "++id",
    });

    /*
     * Datenbankversion 2:
     *
     * - Kategorie bei Übungen
     * - Boulder-Sessions und Flash
     * - Supersätze
     * - Supersatz-Zuordnung bei Tagebucheinträgen
     */
    this.version(2)
      .stores({
        exercises:
          "++id, name, category, bodyPart, type, isActive",

        trainingPlans:
          "++id, name",

        trainingPlanExercises:
          "++id, planId, exerciseId, position",

        diaryEntries:
          "++id, date",

        diaryExercises:
          "++id, diaryEntryId, exerciseId, supersetInstanceId",

        bodyMeasurements:
          "++id, date",

        settings:
          "++id",

        supersets:
          "++id, name",

        supersetExercises:
          "++id, supersetId, exerciseId, position",
      })
      .upgrade(async (transaction) => {
        /*
         * Bestehende Boulder-Übungen werden der Kategorie
         * "Bouldern" zugeordnet.
         *
         * Alle anderen bestehenden Übungen werden automatisch
         * der Kategorie "Kraft" zugeordnet.
         */
        await transaction
          .table<Exercise, number>("exercises")
          .toCollection()
          .modify((exercise) => {
            exercise.category =
              exercise.type === "boulder"
                ? "boulder"
                : "strength";
          });
      });
  }
}

export const db = new BoulderTrackerDB();
