import { getDistance } from 'geolib';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calcula a distância em metros entre duas coordenadas geográficas
 * usando a fórmula de Haversine
 */
export function calculateDistance(
  point1: Coordinates,
  point2: Coordinates
): number {
  return getDistance(
    { latitude: point1.latitude, longitude: point1.longitude },
    { latitude: point2.latitude, longitude: point2.longitude }
  );
}

/**
 * Verifica se um ponto está dentro do raio especificado (em metros)
 * de uma localização central
 */
export function isWithinRadius(
  userLocation: Coordinates,
  targetLocation: Coordinates,
  radiusInMeters: number
): boolean {
  const distance = calculateDistance(userLocation, targetLocation);
  return distance <= radiusInMeters;
}

/**
 * Valida se as coordenadas são válidas
 */
export function isValidCoordinates(coords: Coordinates): boolean {
  return (
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180
  );
}

/**
 * Raio máximo permitido para check-in/check-out (500 metros)
 */
export const MAX_ALLOWED_RADIUS = 500;
