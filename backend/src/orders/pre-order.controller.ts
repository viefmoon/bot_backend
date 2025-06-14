import { Controller, Request, Response, Post } from "@nestjs/common";
import { PreOrderService } from "./pre-order.service";

@Controller("pre-orders")
export class PreOrderController {
  private preOrderService: PreOrderService;

  constructor() {
    this.preOrderService = new PreOrderService();
  }

  @Post("select-products")
  async selectProducts(@Request() req, @Response() res) {
    const { orderItems, customerId, orderType, scheduledDeliveryTime } = req.body;

    try {
      const result = await this.preOrderService.selectProducts({
        orderItems,
        customerId,
        orderType,
        scheduledDeliveryTime,
      });

      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }
}
