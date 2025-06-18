import { Injectable, NotFoundException } from "@nestjs/common";
import { BannedCustomer, Customer, CustomerDeliveryInfo } from "../models";

@Injectable()
export class CustomerService {
  async banCustomer(customerId: string, action: "ban" | "unban") {
    const customer = await Customer.findOne({ where: { customerId } });
    if (!customer) {
      throw new Error("Cliente no encontrado");
    }

    if (action === "ban") {
      const [bannedCustomer, created] = await BannedCustomer.findOrCreate({
        where: { customerId },
      });
      return {
        message: created
          ? "Cliente baneado exitosamente"
          : "El cliente ya está baneado",
        alreadyBanned: !created,
      };
    } else if (action === "unban") {
      const deletedCount = await BannedCustomer.destroy({
        where: { customerId },
      });
      return {
        message:
          deletedCount > 0
            ? "Cliente desbaneado exitosamente"
            : "El cliente no está baneado",
        alreadyBanned: deletedCount === 0,
      };
    }

    throw new Error("Acción no válida");
  }

  async getCustomers() {
    const customers = await Customer.findAll({
      attributes: [
        "customerId",
        "stripeCustomerId",
        "lastInteraction",
        "createdAt",
      ],
      include: [
        {
          model: CustomerDeliveryInfo,
          as: "customerDeliveryInfo",
          attributes: ["streetAddress", "pickupName"],
        },
      ],
    });

    return Promise.all(
      customers.map(async (customer) => {
        const bannedCustomer = await BannedCustomer.findOne({
          where: { customerId: customer.customerId },
        });
        return {
          ...customer.toJSON(),
          isBanned: !!bannedCustomer,
        };
      })
    );
  }
  async getCustomerChatHistory(customerId: string) {
    const customer = await Customer.findOne({
      where: { customerId },
      attributes: ["fullChatHistory"],
    });

    if (!customer) {
      throw new NotFoundException("Cliente no encontrado");
    }

    return customer.fullChatHistory;
  }
}
