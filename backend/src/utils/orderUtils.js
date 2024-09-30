const { Order } = require("../models");

export async function getNextDailyOrderNumber() {
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
