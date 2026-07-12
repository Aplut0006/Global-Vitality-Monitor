import { CountryData } from "../data/countries";

export interface LiveStats {
  currentPopulation: number;
  birthsToday: number;
  deathsToday: number;
  migrationToday: number;
  netGrowthToday: number;
  
  birthsSinceJan1: number;
  deathsSinceJan1: number;
  migrationSinceJan1: number;
  netGrowthSinceJan1: number;

  // Yearly estimates
  yearlyBirths: number;
  yearlyDeaths: number;
  yearlyMigration: number;
  yearlyNetGrowth: number;

  // Frequencies (seconds per event)
  secondsPerBirth: number;
  secondsPerDeath: number;
  secondsPerMigration: number;
  secondsPerNetGrowth: number;
}

const SECONDS_IN_YEAR = 31536000; // 365 days

export function getInitialElapsedSeconds(): number {
  const startOfYear2026 = new Date("2026-01-01T00:00:00Z").getTime();
  return (Date.now() - startOfYear2026) / 1000;
}

export function calculateCountryLiveStats(
  country: CountryData,
  elapsedSeconds: number,
  elapsedSecondsToday: number
): LiveStats {
  const basePop = country.population2026;

  // Annual Births and Deaths based on crude rates per 1,000 people
  const yearlyBirths = (basePop * country.birthRate) / 1000;
  const yearlyDeaths = (basePop * country.deathRate) / 1000;
  
  // Net Growth Rate % represents total net increase (Births - Deaths + Migration)
  const yearlyNetGrowth = basePop * (country.growthRate / 100);
  
  // Migration is the residual: Net Growth - Natural Growth (Births - Deaths)
  const yearlyMigration = yearlyNetGrowth - (yearlyBirths - yearlyDeaths);

  // Per second rates
  const birthsPerSec = yearlyBirths / SECONDS_IN_YEAR;
  const deathsPerSec = yearlyDeaths / SECONDS_IN_YEAR;
  const migrationPerSec = yearlyMigration / SECONDS_IN_YEAR;
  const netGrowthPerSec = yearlyNetGrowth / SECONDS_IN_YEAR;

  // Live cumulative counts since Jan 1, 2026
  const currentPopulation = basePop + elapsedSeconds * netGrowthPerSec;
  const birthsSinceJan1 = elapsedSeconds * birthsPerSec;
  const deathsSinceJan1 = elapsedSeconds * deathsPerSec;
  const migrationSinceJan1 = elapsedSeconds * migrationPerSec;
  const netGrowthSinceJan1 = elapsedSeconds * netGrowthPerSec;

  // Live counts for today
  const birthsToday = elapsedSecondsToday * birthsPerSec;
  const deathsToday = elapsedSecondsToday * deathsPerSec;
  const migrationToday = elapsedSecondsToday * migrationPerSec;
  const netGrowthToday = elapsedSecondsToday * netGrowthPerSec;

  // Seconds per event (with Infinity guard)
  const secondsPerBirth = yearlyBirths > 0 ? SECONDS_IN_YEAR / yearlyBirths : Infinity;
  const secondsPerDeath = yearlyDeaths > 0 ? SECONDS_IN_YEAR / yearlyDeaths : Infinity;
  const secondsPerMigration = Math.abs(yearlyMigration) > 0.1 ? SECONDS_IN_YEAR / Math.abs(yearlyMigration) : Infinity;
  const secondsPerNetGrowth = Math.abs(yearlyNetGrowth) > 0.1 ? SECONDS_IN_YEAR / Math.abs(yearlyNetGrowth) : Infinity;

  return {
    currentPopulation,
    birthsToday,
    deathsToday,
    migrationToday,
    netGrowthToday,
    birthsSinceJan1,
    deathsSinceJan1,
    migrationSinceJan1,
    netGrowthSinceJan1,
    yearlyBirths,
    yearlyDeaths,
    yearlyMigration,
    yearlyNetGrowth,
    secondsPerBirth,
    secondsPerDeath,
    secondsPerMigration,
    secondsPerNetGrowth,
  };
}

// Calculate global aggregate statistics
export function calculateGlobalLiveStats(
  countriesList: CountryData[],
  elapsedSeconds: number,
  elapsedSecondsToday: number
): LiveStats {
  // Let's use the actual estimated world figures (defined in WORLD_STATS) as the primary base,
  // but we can also cross-reference or build them dynamically.
  // Using WORLD_STATS provides a precise match to standard UN database baselines.
  
  const worldBasePop = 8160000000;
  const worldBirthRate = 16.8;
  const worldDeathRate = 7.6;
  const worldGrowthRate = 0.92;

  const yearlyBirths = (worldBasePop * worldBirthRate) / 1000;
  const yearlyDeaths = (worldBasePop * worldDeathRate) / 1000;
  const yearlyNetGrowth = worldBasePop * (worldGrowthRate / 100);
  const yearlyMigration = 0; // Net global migration is 0 (excluding space travel!)

  const birthsPerSec = yearlyBirths / SECONDS_IN_YEAR;
  const deathsPerSec = yearlyDeaths / SECONDS_IN_YEAR;
  const netGrowthPerSec = yearlyNetGrowth / SECONDS_IN_YEAR;

  const currentPopulation = worldBasePop + elapsedSeconds * netGrowthPerSec;
  const birthsSinceJan1 = elapsedSeconds * birthsPerSec;
  const deathsSinceJan1 = elapsedSeconds * deathsPerSec;
  const migrationSinceJan1 = 0;
  const netGrowthSinceJan1 = elapsedSeconds * netGrowthPerSec;

  const birthsToday = elapsedSecondsToday * birthsPerSec;
  const deathsToday = elapsedSecondsToday * deathsPerSec;
  const migrationToday = 0;
  const netGrowthToday = elapsedSecondsToday * netGrowthPerSec;

  const secondsPerBirth = SECONDS_IN_YEAR / yearlyBirths;
  const secondsPerDeath = SECONDS_IN_YEAR / yearlyDeaths;
  const secondsPerMigration = Infinity;
  const secondsPerNetGrowth = SECONDS_IN_YEAR / yearlyNetGrowth;

  return {
    currentPopulation,
    birthsToday,
    deathsToday,
    migrationToday,
    netGrowthToday,
    birthsSinceJan1,
    deathsSinceJan1,
    migrationSinceJan1,
    netGrowthSinceJan1,
    yearlyBirths,
    yearlyDeaths,
    yearlyMigration,
    yearlyNetGrowth,
    secondsPerBirth,
    secondsPerDeath,
    secondsPerMigration,
    secondsPerNetGrowth,
  };
}

export function formatSimulatedDate(elapsedSeconds: number): {
  dateString: string;
  timeString: string;
} {
  const startOfYear2026 = new Date("2026-01-01T00:00:00Z").getTime();
  const simulatedTime = startOfYear2026 + elapsedSeconds * 1000;
  const date = new Date(simulatedTime);

  const dateString = date.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  const timeString = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });

  return { dateString, timeString };
}

export function getSecondsSinceStartOfSimulatedDay(elapsedSeconds: number): number {
  const startOfYear2026 = new Date("2026-01-01T00:00:00Z").getTime();
  const simulatedTime = startOfYear2026 + elapsedSeconds * 1000;
  const date = new Date(simulatedTime);
  
  // Set to midnight UTC of the simulated day
  const midnight = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0,
    0,
    0,
    0
  );
  
  return (simulatedTime - midnight) / 1000;
}
