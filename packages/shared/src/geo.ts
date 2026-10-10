import { LOCATION_REFRESH_PROMPT_DAYS, STORED_COORDINATE_DECIMALS } from "./constants.ts";

export interface Coordinates {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidCoordinates({ lat, lng }: Coordinates): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** Straight-line distance in km. Label it as such in the UI when no routing is available. */
export function haversineKm(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Reduce precision before storing a donor's location (privacy by default). */
export function coarsenCoordinates(coords: Coordinates, decimals: number = STORED_COORDINATE_DECIMALS): Coordinates {
  if (!isValidCoordinates(coords)) throw new RangeError("Invalid coordinates");
  const factor = 10 ** decimals;
  return { lat: Math.round(coords.lat * factor) / factor, lng: Math.round(coords.lng * factor) / factor };
}

/** Manual locations never expire, but stale ones prompt the donor to update. */
export function shouldPromptLocationUpdate(
  updatedAt: Date | null,
  now: Date = new Date(),
  maxAgeDays: number = LOCATION_REFRESH_PROMPT_DAYS,
): boolean {
  if (updatedAt === null) return true;
  return now.getTime() - updatedAt.getTime() > maxAgeDays * DAY_MS;
}