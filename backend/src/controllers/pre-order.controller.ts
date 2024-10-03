import { Request, Response } from "express";
import { PreOrderService } from "../services/pre-order.service";

export class PreOrderController {
  private preOrderService: PreOrderService;

  constructor() {
    this.preOrderService = new PreOrderService();
  }

  async selectProducts(req: Request, res: Response) {
    if (req.method !== "POST") {
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { orderItems, clientId, orderType, scheduledDeliveryTime } = req.body;

    try {
      const result = await this.preOrderService.selectProducts({
        orderItems,
        clientId,
        orderType,
        scheduledDeliveryTime,
      });

      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }
}
