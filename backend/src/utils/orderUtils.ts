import { Op } from "sequelize";
import { Order } from "../models";

export async function getNextDailyOrderNumber(): Promise<number> {
  // Obtener la fecha actual en la zona horaria de México
  const mexicoTime = new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" });
  const todayInMexico = new Date(mexicoTime);
  todayInMexico.setHours(0, 0, 0, 0);

  // Convertir el inicio y fin del día de México a UTC
  const startOfDayUTC = new Date(todayInMexico.getTime() - todayInMexico.getTimezoneOffset() * 60000);
  const endOfDayUTC = new Date(startOfDayUTC.getTime() + 24 * 60 * 60 * 1000);

  const lastOrder = await Order.findOne({
    where: {
      createdAt: {
        [Op.gte]: startOfDayUTC,
        [Op.lt]: endOfDayUTC,
      },
    },
    order: [["dailyOrderNumber", "DESC"]],
  });

  return lastOrder ? lastOrder.dailyOrderNumber + 1 : 1;
}
