import { Injectable, NotFoundException } from "@nestjs/common";
import { Customer, CustomerDeliveryInfo } from "../models";

@Injectable()
export class CustomerDeliveryInfoService {
  async createDeliveryInfo(deliveryInfo: any) {
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

  async updateDeliveryInfo(clientId: string, deliveryInfo: any) {
    const customerDeliveryInfo = await CustomerDeliveryInfo.findOne({
      where: { clientId },
    });

    if (!customerDeliveryInfo) {
      return null;
    }

    await customerDeliveryInfo.update(deliveryInfo);
    return customerDeliveryInfo;
  }

  async getDeliveryInfo(clientId: string) {
    const customerDeliveryInfo = await CustomerDeliveryInfo.findOne({
      where: { clientId },
    });

    if (!customerDeliveryInfo) {
      return null;
    }

    return customerDeliveryInfo;
  }
}
