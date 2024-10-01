import { Injectable } from "@nestjs/common";
import { Customer, CustomerDeliveryInfo } from "../models";

@Injectable()
export class CustomerDeliveryService {
  async createOrUpdateDeliveryInfo(deliveryInfo: any) {
    const { clientId, ...info } = deliveryInfo;

    const [customer] = await Customer.findOrCreate({
      where: { clientId },
      defaults: { clientId },
    });

    const [customerDeliveryInfo, created] =
      await CustomerDeliveryInfo.findOrCreate({
        where: { clientId: customer.clientId },
        defaults: { ...info, clientId: customer.clientId },
      });

    if (!created) {
      await customerDeliveryInfo.update(info);
    }

    return customerDeliveryInfo;
  }
}
