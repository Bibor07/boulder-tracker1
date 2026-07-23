export type ExerciseType = "reps" | "time" | "boulder";

export type BodyPart =
  | "Finger"
  | "Rücken"
  | "Arme"
  | "Core"
  | "Brust"
  | "Beine"
  | "Ganzkörper"
  | "Bouldern";

export type BoulderStyle =
  | "Slab"
  | "Dyno"
  | "Platte"
  | "Dynamisch"
  | "Leiste"
  | "Parkur Style";

export type BoulderGrade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type Sex = "male" | "female";

export interface Exercise {
  id?: number;
  name: string;
  bodyPart: BodyPart;
  type: ExerciseType;

  targetSets?: number;
  targetReps?: number;
  targetTimeSeconds?: number;

  targetBoulderStyle?: BoulderStyle;
  targetBoulderGrade?: BoulderGrade;

  notes?: string;
  isActive: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface TrainingPlan {
  id?: number;
  name: string;
  description?: string;

  position?: number;

  createdAt: string;
  updatedAt: string;
}

export interface TrainingPlanExercise {
  id?: number;
  planId: number;
  exerciseId: number;

  position: number;

  defaultSets?: number;
  defaultReps?: number;
  defaultTimeSeconds?: number;
  defaultWeightKg?: number;

  notes?: string;
}

export interface DiaryEntry {
  id?: number;
  date: string;

  title?: string;
  notes?: string;

  createdAt: string;
  updatedAt: string;
}

export interface DiaryExerciseSet {
  id: string;
  reps?: number;
  timeSeconds?: number;
  weightKg?: number;
}

export interface DiaryExercise {
  id?: number;
  diaryEntryId: number;
  exerciseId: number;

  sets?: number;
  reps?: number;
  timeSeconds?: number;
  weightKg?: number;

  setRows?: DiaryExerciseSet[];

  boulderStyle?: BoulderStyle;
  boulderGrade?: BoulderGrade;
  boulderAttempts?: number;

  notes?: string;

  createdAt: string;
  updatedAt: string;
}

export interface BodyMeasurement {
  id?: number;
  date: string;

  sex: Sex;
  age: number;

  weightKg: number;
  heightCm: number;
  waistCm: number;
  neckCm: number;
  hipCm?: number;

  bmi: number;

  bodyFatNavyPercent: number;
  bodyFatDeurenbergPercent: number;
  bodyFatPercent: number;

  notes?: string;

  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  id?: number;

  sex: Sex;
  heightCm: number;

  theme: "dark" | "light";
  defaultStatisticRange: "month" | "quarter" | "year" | "all";

  createdAt: string;
  updatedAt: string;
}