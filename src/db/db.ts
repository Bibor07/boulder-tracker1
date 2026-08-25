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
  TrainingPlanSuperset,
} from "./types";

export class BoulderTrackerDB extends Dexie {
  exercises!: Table<Exercise, number>;

  trainingPlans!: Table<
    TrainingPlan,
    number
  >;

  trainingPlanExercises!: Table<
    TrainingPlanExercise,
    number
  >;

  trainingPlanSupersets!: Table<
    TrainingPlanSuperset,
    number
  >;

  diaryEntries!: Table<
    DiaryEntry,
    number
  >;

  diaryExercises!: Table<
    DiaryExercise,
    number
  >;

  bodyMeasurements!: Table<
    BodyMeasurement,
    number
  >;

  settings!: Table<
    AppSettings,
    number
  >;

  supersets!: Table<
    Superset,
    number
  >;

  supersetExercises!: Table<
    SupersetExercise,
    number
  >;

  constructor() {
    super("boulder-tracker-db");

    /*
     * Datenbankversion 1
     *
     * Diese Version entspricht dem ursprünglichen
     * Datenbankschema.
     *
     * Nicht verändern oder löschen, da bestehende
     * Installationen dieses Schema für die Migration
     * benötigen.
     */
    this.version(1).stores({
      exercises:
        "++id, name, bodyPart, type, isActive",

      trainingPlans:
        "++id, name",

      trainingPlanExercises:
        "++id, planId, exerciseId, position",

      diaryEntries:
        "++id, date",

      diaryExercises:
        "++id, diaryEntryId, exerciseId",

      bodyMeasurements:
        "++id, date",

      settings:
        "++id",
    });

    /*
     * Datenbankversion 2
     *
     * Neu:
     * - Kategorien bei Übungen
     * - Boulder-Sessions
     * - Flash-Kennzeichnung
     * - Supersätze
     * - Übungen innerhalb von Supersätzen
     * - Supersatz-Zuordnung in Tagebucheinträgen
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
         * Bestehende Boulder-Übungen werden
         * der Kategorie "Bouldern" zugeordnet.
         *
         * Alle anderen bestehenden Übungen
         * werden der Kategorie "Kraft" zugeordnet.
         */
        await transaction
          .table<Exercise, number>(
            "exercises"
          )
          .toCollection()
          .modify((exercise) => {
            exercise.category =
              exercise.type === "boulder"
                ? "boulder"
                : "strength";
          });
      });

    /*
     * Datenbankversion 3
     *
     * Neu:
     * - Trainingspläne können aktiv/passiv sein
     * - Supersätze können aktiv/passiv sein
     * - Supersätze können Trainingsplänen
     *   zugeordnet werden
     */
    this.version(3)
      .stores({
        exercises:
          "++id, name, category, bodyPart, type, isActive",

        trainingPlans:
          "++id, name, isActive",

        trainingPlanExercises:
          "++id, planId, exerciseId, position",

        trainingPlanSupersets:
          "++id, planId, supersetId, position",

        diaryEntries:
          "++id, date",

        diaryExercises:
          "++id, diaryEntryId, exerciseId, supersetInstanceId",

        bodyMeasurements:
          "++id, date",

        settings:
          "++id",

        supersets:
          "++id, name, isActive",

        supersetExercises:
          "++id, supersetId, exerciseId, position",
      })
      .upgrade(async (transaction) => {
        /*
         * Alte Trainingspläne besitzen noch
         * kein isActive-Feld.
         *
         * Sie werden beim Upgrade automatisch
         * als aktiv markiert.
         */
        await transaction
          .table<TrainingPlan, number>(
            "trainingPlans"
          )
          .toCollection()
          .modify((plan) => {
            if (
              plan.isActive === undefined
            ) {
              plan.isActive = true;
            }
          });

        /*
         * Bereits mit Version 2 erstellte
         * Supersätze besitzen noch kein
         * isActive-Feld.
         *
         * Sie werden beim Upgrade automatisch
         * als aktiv markiert.
         */
        await transaction
          .table<Superset, number>(
            "supersets"
          )
          .toCollection()
          .modify((superset) => {
            if (
              superset.isActive === undefined
            ) {
              superset.isActive = true;
            }
          });
      });
  }
}

export const db = new BoulderTrackerDB();