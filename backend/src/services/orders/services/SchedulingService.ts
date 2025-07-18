import { RestaurantService } from "../../restaurant/RestaurantService";
import { ValidationError, ErrorCode } from "../../../common/services/errors";
import { env } from "../../../common/config/envValidator";
import { OrderType } from '@prisma/client';

export class SchedulingService {
  /**
   * Validate and process scheduled delivery time
   */
  static async validateScheduledTime(
    scheduledAt: string | Date | undefined,
    orderType: OrderType
  ): Promise<Date | null> {
    if (!scheduledAt || scheduledAt === "null") {
      return null;
    }

    const now = new Date();
    let fullScheduledDeliveryTime: Date;

    if (scheduledAt instanceof Date) {
      fullScheduledDeliveryTime = scheduledAt;
    } else {
      const timeParts = scheduledAt.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (!timeParts) {
        throw new ValidationError(
          ErrorCode.INVALID_SCHEDULE_TIME,
          'Invalid time format',
          { metadata: { scheduledAt } }
        );
      }

      let hours = parseInt(timeParts[1]);
      const minutes = parseInt(timeParts[2]);
      const meridiem = timeParts[3];

      if (meridiem) {
        if (meridiem.toUpperCase() === "PM" && hours !== 12) {
          hours += 12;
        } else if (meridiem.toUpperCase() === "AM" && hours === 12) {
          hours = 0;
        }
      }

      fullScheduledDeliveryTime = new Date(now);
      fullScheduledDeliveryTime.setHours(hours, minutes, 0, 0);

      if (fullScheduledDeliveryTime <= now) {
        fullScheduledDeliveryTime.setDate(fullScheduledDeliveryTime.getDate() + 1);
      }
    }

    // Validate against business hours
    await this.validateAgainstBusinessHours(fullScheduledDeliveryTime, orderType);

    return fullScheduledDeliveryTime;
  }

  /**
   * Validate scheduled time against business hours
   */
  private static async validateAgainstBusinessHours(
    scheduledTime: Date,
    orderType: OrderType
  ): Promise<void> {
    const config = await RestaurantService.getConfig();
    
    // Convert to Mexico time
    const mexicoTime = new Date(
      scheduledTime.toLocaleString("en-US", {
        timeZone: config.timeZone || env.DEFAULT_TIMEZONE,
      })
    );

    const dayOfWeek = mexicoTime.getDay();
    const scheduledHour = mexicoTime.getHours();
    const scheduledMinute = mexicoTime.getMinutes();

    // Get business hours for the day
    const businessHours = await RestaurantService.getBusinessHoursForDay(dayOfWeek);
    
    if (!businessHours || businessHours.isClosed || !businessHours.openingTime || !businessHours.closingTime) {
      throw new ValidationError(
        ErrorCode.RESTAURANT_CLOSED,
        '😔 El restaurante está cerrado en el horario solicitado. Por favor, elige otro horario cuando estemos abiertos.'
      );
    }

    // Parse opening and closing times
    const [openingHour, openingMinute] = businessHours.openingTime.split(":").map(Number);
    const [closingHour, closingMinute] = businessHours.closingTime.split(":").map(Number);
    const openingMinutes = openingHour * 60 + openingMinute;
    const closingMinutes = closingHour * 60 + closingMinute;

    // Apply grace periods
    const openingGracePeriod = config.openingGracePeriod || 0;
    const closingGracePeriod = config.closingGracePeriod || 0;
    const adjustedOpeningMinutes = openingMinutes - openingGracePeriod;
    const adjustedClosingMinutes = closingMinutes + closingGracePeriod;

    // Convert scheduled time to minutes
    const scheduledMinutes = scheduledHour * 60 + scheduledMinute;

    // Check if within hours
    if (scheduledMinutes < adjustedOpeningMinutes || scheduledMinutes > adjustedClosingMinutes) {
      const adjustedOpeningTime = new Date(mexicoTime);
      adjustedOpeningTime.setHours(openingHour, openingMinute - openingGracePeriod);
      
      const adjustedClosingTime = new Date(mexicoTime);
      adjustedClosingTime.setHours(closingHour, closingMinute + closingGracePeriod);

      const openingFormatted = adjustedOpeningTime.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const closingFormatted = adjustedClosingTime.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      throw new ValidationError(
        ErrorCode.INVALID_SCHEDULE_TIME,
        `Scheduled time is outside business hours. Please schedule between ${openingFormatted} and ${closingFormatted}`,
        { metadata: { scheduledMinutes, adjustedOpeningMinutes, adjustedClosingMinutes } }
      );
    }

    // Check minimum time requirement
    const minTimeRequired = orderType === OrderType.TAKE_AWAY 
      ? config.estimatedPickupTime 
      : config.estimatedDeliveryTime;
    
    const now = new Date();
    const timeDifference = (scheduledTime.getTime() - now.getTime()) / (1000 * 60);

    if (timeDifference < minTimeRequired) {
      throw new ValidationError(
        ErrorCode.INVALID_SCHEDULE_TIME,
        `Scheduled time must be at least ${minTimeRequired} minutes from now`,
        { metadata: { timeDifference, minTimeRequired } }
      );
    }
  }
}