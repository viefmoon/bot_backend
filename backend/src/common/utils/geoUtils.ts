import { getRestaurantConfig } from '../../services/restaurantConfig';
import logger from './logger';

/**
 * Verifica si un punto está dentro de un polígono usando el algoritmo ray-casting
 * @param point [latitude, longitude]
 * @param polygon Array de coordenadas [[lat1, lng1], [lat2, lng2], ...]
 * @returns true si el punto está dentro del polígono
 */
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [lat, lng] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [lat1, lng1] = polygon[i];
    const [lat2, lng2] = polygon[j];

    const intersect = ((lat1 > lat) !== (lat2 > lat)) &&
      (lng < (lng2 - lng1) * (lat - lat1) / (lat2 - lat1) + lng1);

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Calcula la distancia entre dos puntos usando la fórmula Haversine
 * @param lat1 Latitud del primer punto
 * @param lon1 Longitud del primer punto
 * @param lat2 Latitud del segundo punto
 * @param lon2 Longitud del segundo punto
 * @returns Distancia en kilómetros
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radio de la Tierra en kilómetros
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Verifica si una ubicación está dentro del área de cobertura del restaurante
 * @param latitude Latitud de la ubicación
 * @param longitude Longitud de la ubicación
 * @returns true si está dentro del área de cobertura
 */
export async function isWithinDeliveryArea(latitude: number, longitude: number): Promise<boolean> {
  try {
    const config = await getRestaurantConfig();
    
    // Si hay un polígono definido, usarlo
    if (config.deliveryCoverageArea && Array.isArray(config.deliveryCoverageArea)) {
      const polygon = config.deliveryCoverageArea as [number, number][];
      return isPointInPolygon([latitude, longitude], polygon);
    }
    
    // Si no hay polígono pero hay centro y radio, usar distancia
    if (config.centerLatitude && config.centerLongitude && config.maxDeliveryRadius) {
      const distance = calculateDistance(
        latitude, 
        longitude, 
        config.centerLatitude, 
        config.centerLongitude
      );
      return distance <= config.maxDeliveryRadius;
    }
    
    // Si no hay configuración de área, aceptar todas las direcciones
    logger.warn('No delivery area configuration found, accepting all addresses');
    return true;
  } catch (error) {
    logger.error('Error checking delivery area:', error);
    // En caso de error, aceptar la dirección para no bloquear el servicio
    return true;
  }
}

/**
 * Obtiene información sobre el área de cobertura
 */
export async function getDeliveryAreaInfo(): Promise<{
  hasPolygon: boolean;
  hasRadius: boolean;
  polygon?: [number, number][];
  center?: { lat: number; lng: number };
  radius?: number;
}> {
  try {
    const config = await getRestaurantConfig();
    
    return {
      hasPolygon: !!config.deliveryCoverageArea,
      hasRadius: !!(config.centerLatitude && config.centerLongitude && config.maxDeliveryRadius),
      polygon: config.deliveryCoverageArea as [number, number][] | undefined,
      center: config.centerLatitude && config.centerLongitude 
        ? { lat: config.centerLatitude, lng: config.centerLongitude }
        : undefined,
      radius: config.maxDeliveryRadius || undefined
    };
  } catch (error) {
    logger.error('Error getting delivery area info:', error);
    return { hasPolygon: false, hasRadius: false };
  }
}