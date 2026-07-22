import { db } from "../db/db";

type BackupTableName =
  | "exercises"
  | "trainingPlans"
  | "trainingPlanExercises"
  | "diaryEntries"
  | "diaryExercises"
  | "bodyMeasurements"
  | "appSettings";

export type AppBackup = {
  version: 1;
  exportedAt: string;
  data: Partial<Record<BackupTableName, unknown[]>>;
};

const backupTables: BackupTableName[] = [
  "exercises",
  "trainingPlans",
  "trainingPlanExercises",
  "diaryEntries",
  "diaryExercises",
  "bodyMeasurements",
  "appSettings",
];

async function tableExists(tableName: string) {
  return db.tables.some((table) => table.name === tableName);
}

async function exportTable(tableName: BackupTableName) {
  if (!(await tableExists(tableName))) {
    return [];
  }

  return db.table(tableName).toArray();
}

export async function createBackup(): Promise<AppBackup> {
  const data: Partial<Record<BackupTableName, unknown[]>> = {};

  for (const tableName of backupTables) {
    data[tableName] = await exportTable(tableName);
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export async function exportBackupJson() {
  const backup = await createBackup();
  const json = JSON.stringify(backup, null, 2);

  const blob = new Blob([json], {
    type: "application/json;charset=utf-8",
  });

  const date = new Date().toISOString().slice(0, 10);
  const fileName = `VerticalProgress_Backup_${date}.json`;

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);

  localStorage.setItem("lastBackupAt", new Date().toISOString());
}

async function importTable(tableName: BackupTableName, rows: unknown[] = []) {
  if (!(await tableExists(tableName))) {
    return;
  }

  await db.table(tableName).clear();

  if (rows.length > 0) {
    await db.table(tableName).bulkAdd(rows);
  }
}

export async function importBackupJson(file: File) {
  const text = await file.text();
  const backup = JSON.parse(text) as AppBackup;

  if (!backup || backup.version !== 1 || !backup.data) {
    throw new Error("Ungültige Backup-Datei.");
  }

  await db.transaction("rw", db.tables, async () => {
    for (const tableName of backupTables) {
      await importTable(tableName, backup.data[tableName] ?? []);
    }
  });

  localStorage.setItem("lastBackupAt", new Date().toISOString());
}

export function getLastBackupAt() {
  return localStorage.getItem("lastBackupAt");
}

export function shouldShowBackupReminder(days = 7) {
  const lastBackupAt = getLastBackupAt();

  if (!lastBackupAt) return true;

  const lastBackupTime = new Date(lastBackupAt).getTime();
  const now = Date.now();
  const diffDays = (now - lastBackupTime) / (1000 * 60 * 60 * 24);

  return diffDays >= days;
}

export function formatLastBackupDate() {
  const lastBackupAt = getLastBackupAt();

  if (!lastBackupAt) return "Noch kein Backup erstellt";

  return new Date(lastBackupAt).toLocaleString("de-DE");
}