import * as moment from "moment-timezone";
import * as dotenv from "dotenv";
dotenv.config();

import { Op } from "sequelize";
import { Order } from "../models";
import logger from "./logger";

const TIME_ZONE = process.env.TIME_ZONE;

interface BusinessHours {
  opening: number;
  closing: number;
}

const parseTime = (timeString: string): number => {
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
};

const businessHours: { [key: string]: BusinessHours } = {
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

  let hours: BusinessHours;

  if (dayOfWeek === 0) { // Sunday
    hours = businessHours.sunday;
  } else if (dayOfWeek >= 2 && dayOfWeek <= 6) { // Tuesday to Saturday
    hours = businessHours.weekdays;
  } else { // Monday (closed)
    return false;
  }

  return currentMinutes >= hours.opening && currentMinutes < hours.closing;
};

export { getCurrentMexicoTime, isBusinessOpen, getUTCTime };

export async function getNextDailyOrderNumber(): Promise<number> {
  try {
    // Obtener la fecha actual en la zona horaria de México
    const todayInMexico = moment.tz(TIME_ZONE);

    // Definir el inicio y fin del día en UTC
    const startOfDayUTC = todayInMexico.clone().startOf("day").utc();
    const endOfDayUTC = todayInMexico.clone().endOf("day").utc();

    const lastOrder = await Order.findOne({
      where: {
        createdAt: {
          [Op.gte]: startOfDayUTC.toDate(),
          [Op.lt]: endOfDayUTC.toDate(),
        },
      },
      order: [["dailyOrderNumber", "DESC"]],
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
