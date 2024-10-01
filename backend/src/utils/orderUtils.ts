import { Order } from "../models";

export async function getNextDailyOrderNumber(): Promise<number> {
  const mexicoTime = new Date().toLocaleString("en-US", {
    timeZone: "America/Mexico_City",
  });
  const today = new Date(mexicoTime).toISOString().split("T")[0];

  const lastOrder = await Order.findOne({
    where: {
      orderDate: today,
    },
    order: [["dailyOrderNumber", "DESC"]],
  });

  return lastOrder ? lastOrder.dailyOrderNumber + 1 : 1;
}
