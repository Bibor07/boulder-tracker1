import Dexie, { type Table } from "dexie";

import type {
  AppSettings,
  BodyMeasurement,
  DiaryEntry,
  DiaryExercise,
  Exercise,
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

  constructor() {
    super("boulder-tracker-db");

    this.version(1).stores({
      exercises: "++id, name, bodyPart, type, isActive",
      trainingPlans: "++id, name",
      trainingPlanExercises: "++id, planId, exerciseId, position",
      diaryEntries: "++id, date",
      diaryExercises: "++id, diaryEntryId, exerciseId",
      bodyMeasurements: "++id, date",
      settings: "++id",
    });
  }
}

export const db = new BoulderTrackerDB();