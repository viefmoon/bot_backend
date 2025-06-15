import moment from "moment-timezone";
import { prisma } from "../server";
import logger from "./logger";

const TIME_ZONE = process.env.TIME_ZONE;

const parseTime = (timeString: string): number => {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
};

const businessHours: { [key: string]: { opening: number; closing: number } } = {
  weekdays: {
    opening: parseTime(process.env.OPENING_HOURS_TUES_SAT),
    closing: parseTime(process.env.CLOSING_HOURS_TUES_SAT),
  },
  sunday: {
    opening: parseTime(process.env.OPENING_HOURS_SUN),
    closing: parseTime(process.env.CLOSING_HOURS_SUN),
  },
};

const getCurrentMexicoTime = (): moment.Moment => {
  return moment().tz(TIME_ZONE);
};

const getUTCTime = (): moment.Moment => {
  return moment().utc();
};

const isBusinessOpen = (): boolean => {
  const now = getCurrentMexicoTime();
  const dayOfWeek = now.day();
  const currentMinutes = now.hours() * 60 + now.minutes();

  let hours: { opening: number; closing: number };

  if (dayOfWeek === 0) {
    // Sunday
    hours = businessHours.sunday;
  } else if (dayOfWeek >= 2 && dayOfWeek <= 6) {
    // Tuesday to Saturday
    hours = businessHours.weekdays;
  } else {
    // Monday (closed)
    return false;
  }

  return currentMinutes >= hours.opening && currentMinutes < hours.closing;
};

export { getCurrentMexicoTime, isBusinessOpen, getUTCTime };

interface BusinessHoursValidation {
  isOpen: boolean;
  message: string;
}

export async function isWithinBusinessHours(scheduledTime?: Date): Promise<BusinessHoursValidation> {
  const mexicoTime = scheduledTime 
    ? moment.tz(scheduledTime, TIME_ZONE)
    : moment.tz(TIME_ZONE);
  
  const dayOfWeek = mexicoTime.day();
  const currentMinutes = mexicoTime.hours() * 60 + mexicoTime.minutes();

  // Monday closed
  if (dayOfWeek === 1) {
    return {
      isOpen: false,
      message: "Lo sentimos, los lunes estamos cerrados. Nuestro horario es:\n" +
              "• Martes a Sábado: 2:00 PM - 10:00 PM\n" +
              "• Domingo: 2:00 PM - 9:00 PM"
    };
  }

  let hours: { opening: number; closing: number };
  
  if (dayOfWeek === 0) {
    hours = businessHours.sunday;
  } else if (dayOfWeek >= 2 && dayOfWeek <= 6) {
    hours = businessHours.weekdays;
  } else {
    return {
      isOpen: false,
      message: "Día no válido"
    };
  }

  // Grace periods
  const openingGracePeriod = parseInt(process.env.OPENING_GRACE_PERIOD_MINUTES || '30');
  const closingGracePeriod = parseInt(process.env.CLOSING_GRACE_PERIOD_MINUTES || '30');
  
  const adjustedOpening = hours.opening - openingGracePeriod;
  const adjustedClosing = hours.closing + closingGracePeriod;

  if (currentMinutes < adjustedOpening || currentMinutes > adjustedClosing) {
    const formatTime = (minutes: number) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return moment().hours(h).minutes(m).format('h:mm A');
    };

    return {
      isOpen: false,
      message: `⚠️ Estamos cerrados. Nuestro horario hoy es de ${formatTime(adjustedOpening)} a ${formatTime(adjustedClosing)}.`
    };
  }

  return {
    isOpen: true,
    message: "Abierto"
  };
}

export async function getNextDailyOrderNumber(): Promise<number> {
  try {
    // Obtener la fecha actual en la zona horaria de México
    const todayInMexico = moment.tz(TIME_ZONE);

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
      }
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

export function getMexicoDayRange(dateString: string): {
  startDate: Date;
  endDate: Date;
} {
  const mexicoDate = moment.tz(dateString, TIME_ZONE).startOf("day");

  const startDate = mexicoDate.clone().utc().toDate();
  const endDate = mexicoDate.clone().endOf("day").utc().toDate();

  return { startDate, endDate };
}
