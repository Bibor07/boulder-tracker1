export function calculateBodyFatMaleNavyCm(
  heightCm: number,
  waistCm: number,
  neckCm: number
): number {
  if (heightCm <= 0 || waistCm <= 0 || neckCm <= 0) {
    throw new Error("Größe, Taille und Nacken müssen größer als 0 sein.");
  }

  if (waistCm <= neckCm) {
    throw new Error("Taille muss größer als Nacken sein.");
  }

  const bodyFat =
    86.01 * Math.log10(waistCm - neckCm) -
    70.041 * Math.log10(heightCm) +
    36.76;

  return Number(bodyFat.toFixed(1));
}

export function calculateBodyFatFemaleNavyCm(
  heightCm: number,
  waistCm: number,
  neckCm: number,
  hipCm: number
): number {
  if (heightCm <= 0 || waistCm <= 0 || neckCm <= 0 || hipCm <= 0) {
    throw new Error("Größe, Taille, Nacken und Hüfte müssen größer als 0 sein.");
  }

  if (waistCm + hipCm <= neckCm) {
    throw new Error("Taille + Hüfte muss größer als Nacken sein.");
  }

  const bodyFat =
    163.205 * Math.log10(waistCm + hipCm - neckCm) -
    97.684 * Math.log10(heightCm) -
    78.387;

  return Number(bodyFat.toFixed(1));
}