// Converts a raw value + unit into µg/m³ so every parameter is comparable
// regardless of which source or unit convention it arrived in.
// (This is a simplified conversion table — real-world AQI calculation uses
// EPA breakpoint tables per pollutant, which you can swap in later.)
export function normalizeToUgM3(value: number, unit: string, parameter: string): number {
  const u = unit.toLowerCase();

  if (u === "µg/m³" || u === "ug/m3") return value;

  if (u === "ppm" || u === "ppb") {
    // Approximate molar-mass-based conversion factors at standard conditions.
    const molarMass: Record<string, number> = {
      no2: 46.0,
      o3: 48.0,
      so2: 64.0,
      co: 28.0,
    };
    const mass = molarMass[parameter.toLowerCase()];
    if (!mass) {
      throw new Error(`No molar mass known for parameter "${parameter}" — cannot convert ${unit}`);
    }
    const ppmValue = u === "ppb" ? value / 1000 : value;
    return ppmValue * (mass / 24.45) * 1000;
  }

  throw new Error(`Unrecognized unit "${unit}" for parameter "${parameter}"`);
}

// Very simplified AQI bucket for PM2.5, just to demonstrate the pattern —
// swap in the full EPA breakpoint table for production accuracy.
export function computePm25Aqi(ugM3: number): number {
  if (ugM3 <= 12) return Math.round((50 / 12) * ugM3);
  if (ugM3 <= 35.4) return Math.round(50 + ((100 - 50) / (35.4 - 12.1)) * (ugM3 - 12.1));
  if (ugM3 <= 55.4) return Math.round(100 + ((150 - 100) / (55.4 - 35.5)) * (ugM3 - 35.5));
  if (ugM3 <= 150.4) return Math.round(150 + ((200 - 150) / (150.4 - 55.5)) * (ugM3 - 55.5));
  return Math.round(200 + ((300 - 200) / (250.4 - 150.5)) * (ugM3 - 150.5));
}
