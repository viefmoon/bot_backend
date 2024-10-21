import * as moment from "moment-timezone";
import * as dotenv from "dotenv";
dotenv.config();

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
