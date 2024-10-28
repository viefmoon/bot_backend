import { Injectable, NotFoundException } from "@nestjs/common";
import { Customer, CustomerDeliveryInfo } from "../models";

@Injectable()
export class CustomerDeliveryInfoService {
  async createDeliveryInfo(deliveryInfo: any) {
    const { customerId, ...info } = deliveryInfo;

    const [customer] = await Customer.findOrCreate({
      where: { customerId },
      defaults: { customerId },
    });

    const [customerDeliveryInfo, created] =
      await CustomerDeliveryInfo.findOrCreate({
        where: { customerId: customer.customerId },
        defaults: { ...info, customerId: customer.customerId },
      });

    if (!created) {
      await customerDeliveryInfo.update(info);
    }

    return customerDeliveryInfo;
  }

  async updateDeliveryInfo(customerId: string, deliveryInfo: any) {
    const customerDeliveryInfo = await CustomerDeliveryInfo.findOne({
      where: { customerId },
    });

    if (!customerDeliveryInfo) {
      return null;
    }

    await customerDeliveryInfo.update(deliveryInfo);
    return customerDeliveryInfo;
  }

  async getDeliveryInfo(customerId: string) {
    console.log("customerId", customerId);
    const customerDeliveryInfo = await CustomerDeliveryInfo.findOne({
      where: { customerId },
    });
    console.log("customerDeliveryInfo", customerDeliveryInfo);

    if (!customerDeliveryInfo) {
      return null;
    }

    return customerDeliveryInfo;
  }
}
