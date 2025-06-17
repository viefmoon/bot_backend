import moment from "moment-timezone";
import { prisma } from "../../server";
import logger from "./logger";
import { RestaurantService } from "../../services/restaurant/RestaurantService";

// Cache for timezone
let cachedTimeZone: string | null = null;

async function getTimeZone(): Promise<string> {
  try {
    if (cachedTimeZone) {
      return cachedTimeZone;
    }
    
    const config = await RestaurantService.getConfig();
    cachedTimeZone = config.timeZone || "America/Mexico_City";
    return cachedTimeZone;
  } catch (error) {
    logger.error("Error getting timezone from config:", error);
    // Fallback to default timezone
    return "America/Mexico_City";
  }
}

const parseTime = (timeString: string): number => {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
};

const getCurrentMexicoTime = async (): Promise<moment.Moment> => {
  const timeZone = await getTimeZone();
  return moment().tz(timeZone);
};

const getUTCTime = (): moment.Moment => {
  return moment().utc();
};

// Helper function to clear timezone cache when config changes
export function clearTimeZoneCache(): void {
  cachedTimeZone = null;
}

const isBusinessOpen = async (): Promise<boolean> => {
  try {
    const now = await getCurrentMexicoTime();
    const dayOfWeek = now.day();
    const currentMinutes = now.hours() * 60 + now.minutes();

    // Get business hours for current day
    const todayHours = await RestaurantService.getBusinessHoursForDay(dayOfWeek);
    
    if (!todayHours || todayHours.isClosed || !todayHours.openingTime || !todayHours.closingTime) {
      return false;
    }

    const openingMinutes = parseTime(todayHours.openingTime);
    const closingMinutes = parseTime(todayHours.closingTime);

    // Get restaurant config for grace periods
    const config = await RestaurantService.getConfig();
    
    // Apply grace periods
    const effectiveOpeningTime = openingMinutes + (config.openingGracePeriod || 0);
    const effectiveClosingTime = closingMinutes - (config.closingGracePeriod || 0);

    return currentMinutes >= effectiveOpeningTime && currentMinutes < effectiveClosingTime;
  } catch (error) {
    logger.error("Error checking if business is open:", error);
    // Fallback to closed if database fails
    return false;
  }
};

export { getCurrentMexicoTime, isBusinessOpen, getUTCTime };

export async function getFormattedBusinessHours(): Promise<string> {
  try {
    const { getAllBusinessHours } = await import("../../services/restaurantConfig");
    const hours = await getAllBusinessHours();
    
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    
    const formattedHours = hours.map(h => {
      if (h.isClosed || !h.openingTime || !h.closingTime) {
        return `${dayNames[h.dayOfWeek]}: Cerrado`;
      }
      return `${dayNames[h.dayOfWeek]}: ${h.openingTime} - ${h.closingTime}`;
    });
    
    return formattedHours.join('\n');
  } catch (error) {
    logger.error("Error getting formatted business hours:", error);
    return "Horarios no disponibles";
  }
}

export async function getBusinessStatus(): Promise<{
  isOpen: boolean;
  message: string;
  nextOpeningTime?: string;
}> {
  try {
    const now = await getCurrentMexicoTime();
    const dayOfWeek = now.day();
    const currentMinutes = now.hours() * 60 + now.minutes();
    
    const todayHours = await RestaurantService.getBusinessHoursForDay(dayOfWeek);
    const config = await RestaurantService.getConfig();
    
    if (!todayHours || todayHours.isClosed || !todayHours.openingTime || !todayHours.closingTime) {
      // Find next opening day
      let nextDay = (dayOfWeek + 1) % 7;
      let daysChecked = 0;
      
      while (daysChecked < 7) {
        const nextDayHours = await RestaurantService.getBusinessHoursForDay(nextDay);
        if (nextDayHours && !nextDayHours.isClosed && nextDayHours.openingTime) {
          const dayName = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][nextDay];
          return {
            isOpen: false,
            message: `⏰ Estamos cerrados hoy. Abrimos el ${dayName} a las ${nextDayHours.openingTime} hrs. 🍕`,
            nextOpeningTime: nextDayHours.openingTime
          };
        }
        nextDay = (nextDay + 1) % 7;
        daysChecked++;
      }
      
      return {
        isOpen: false,
        message: "⏰ Estamos cerrados. Por favor, contacta al restaurante para más información. 📞"
      };
    }
    
    const openingMinutes = parseTime(todayHours.openingTime);
    const closingMinutes = parseTime(todayHours.closingTime);
    const effectiveOpeningTime = openingMinutes + (config.openingGracePeriod || 0);
    const effectiveClosingTime = closingMinutes - (config.closingGracePeriod || 0);
    
    // Before opening (including grace period)
    if (currentMinutes < effectiveOpeningTime) {
      const minutesUntilOpen = effectiveOpeningTime - currentMinutes;
      if (minutesUntilOpen <= 60) {
        return {
          isOpen: false,
          message: `⏰ Abrimos en ${minutesUntilOpen} minutos. Por favor, espera un momento. 🍕`,
          nextOpeningTime: todayHours.openingTime
        };
      }
      return {
        isOpen: false,
        message: `⏰ Abrimos a las ${todayHours.openingTime} hrs. ¡Te esperamos! 🍕`,
        nextOpeningTime: todayHours.openingTime
      };
    }
    
    // Near closing time (within grace period)
    if (currentMinutes >= effectiveClosingTime && currentMinutes < closingMinutes) {
      const minutesUntilClose = closingMinutes - currentMinutes;
      return {
        isOpen: false,
        message: `⏰ Ya no estamos tomando pedidos. Cerramos en ${minutesUntilClose} minutos. ¡Vuelve mañana! 🍕`
      };
    }
    
    // After closing
    if (currentMinutes >= closingMinutes) {
      // Find next opening (tomorrow or next available day)
      let nextDay = (dayOfWeek + 1) % 7;
      let daysChecked = 0;
      
      while (daysChecked < 7) {
        const nextDayHours = await RestaurantService.getBusinessHoursForDay(nextDay);
        if (nextDayHours && !nextDayHours.isClosed && nextDayHours.openingTime) {
          const dayName = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][nextDay];
          return {
            isOpen: false,
            message: `⏰ Ya cerramos por hoy. Abrimos el ${dayName} a las ${nextDayHours.openingTime} hrs. ¡Te esperamos! 🍕`,
            nextOpeningTime: nextDayHours.openingTime
          };
        }
        nextDay = (nextDay + 1) % 7;
        daysChecked++;
      }
    }
    
    // Restaurant is open
    const minutesUntilEffectiveClose = effectiveClosingTime - currentMinutes;
    if (minutesUntilEffectiveClose <= 30) {
      return {
        isOpen: true,
        message: `✅ Estamos abiertos. ⚠️ Último momento para ordenar, cerramos pronto (en ${minutesUntilEffectiveClose} minutos).`
      };
    }
    
    return {
      isOpen: true,
      message: "✅ Estamos abiertos y listos para tomar tu pedido. 🍕"
    };
  } catch (error) {
    logger.error("Error getting business status:", error);
    return {
      isOpen: false,
      message: "❌ Error al verificar el horario. Por favor, contacta al restaurante."
    };
  }
}

export async function getNextDailyOrderNumber(): Promise<number> {
  try {
    // Obtener la fecha actual en la zona horaria del restaurante
    const timeZone = await getTimeZone();
    const todayInMexico = moment.tz(timeZone);

    // Definir el inicio y fin del día en UTC
    const startOfDayUTC = todayInMexico.clone().startOf("day").utc();
    const endOfDayUTC = todayInMexico.clone().endOf("day").utc();

    const lastOrder = await prisma.order.findFirst({
      where: {
        createdAt: {
          gte: startOfDayUTC.toDate(),
          lt: endOfDayUTC.toDate(),
        },
      },
      orderBy: {
        dailyOrderNumber: "desc"
      },
    });

    return lastOrder ? lastOrder.dailyOrderNumber + 1 : 1;
  } catch (error) {
    logger.error(
      "Error al obtener el siguiente número de orden diaria:",
      error
    );
    throw error;
  }
}

export async function getMexicoDayRange(dateString: string): Promise<{
  startDate: Date;
  endDate: Date;
}> {
  const timeZone = await getTimeZone();
  const mexicoDate = moment.tz(dateString, timeZone).startOf("day");

  const startDate = mexicoDate.clone().utc().toDate();
  const endDate = mexicoDate.clone().endOf("day").utc().toDate();

  return { startDate, endDate };
}
