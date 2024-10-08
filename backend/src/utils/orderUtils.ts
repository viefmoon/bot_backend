import * as moment from "moment-timezone";
import { Op } from "sequelize";
import { Order } from "../models";

export async function getNextDailyOrderNumber(): Promise<number> {
  try {
    // Obtener la fecha actual en la zona horaria de México
    const todayInMexico = moment.tz("America/Mexico_City");

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
    console.error(
      "Error al obtener el siguiente número de orden diaria:",
      error
    );
    throw error;
  }
}
