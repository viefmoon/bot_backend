import { RestaurantService } from '../../services/restaurant/RestaurantService';
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
 * Verifica si una ubicación está dentro del área de cobertura del restaurante
 * @param latitude Latitud de la ubicación
 * @param longitude Longitud de la ubicación
 * @returns true si está dentro del área de cobertura
 */
export async function isWithinDeliveryArea(latitude: number, longitude: number): Promise<boolean> {
  try {
    const config = await RestaurantService.getConfig();
    
    // Si hay un polígono definido, usarlo
    if (config.deliveryCoverageArea && Array.isArray(config.deliveryCoverageArea)) {
      const polygon = config.deliveryCoverageArea as [number, number][];
      return isPointInPolygon([latitude, longitude], polygon);
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
  polygon?: [number, number][];
}> {
  try {
    const config = await RestaurantService.getConfig();
    
    return {
      hasPolygon: !!config.deliveryCoverageArea,
      polygon: config.deliveryCoverageArea as [number, number][] | undefined
    };
  } catch (error) {
    logger.error('Error getting delivery area info:', error);
    return { hasPolygon: false };
  }
}