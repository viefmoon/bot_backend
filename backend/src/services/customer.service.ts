import { Injectable, NotFoundException } from "@nestjs/common";
import { BannedCustomer, Customer, CustomerDeliveryInfo } from "../models";

@Injectable()
export class CustomerService {
  async banCustomer(clientId: string, action: "ban" | "unban") {
    const customer = await Customer.findOne({ where: { clientId } });
    if (!customer) {
      throw new Error("Cliente no encontrado");
    }

    if (action === "ban") {
      const [bannedCustomer, created] = await BannedCustomer.findOrCreate({
        where: { clientId },
      });
      return {
        message: created
          ? "Cliente baneado exitosamente"
          : "El cliente ya está baneado",
        alreadyBanned: !created,
      };
    } else if (action === "unban") {
      const deletedCount = await BannedCustomer.destroy({
        where: { clientId },
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
        "clientId",
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
          where: { clientId: customer.clientId },
        });
        return {
          ...customer.toJSON(),
          isBanned: !!bannedCustomer,
        };
      })
    );
  }
  async getCustomerChatHistory(clientId: string) {
    const customer = await Customer.findOne({
      where: { clientId },
      attributes: ["fullChatHistory"],
    });

    if (!customer) {
      throw new NotFoundException("Cliente no encontrado");
    }

    return customer.fullChatHistory;
  }
}
