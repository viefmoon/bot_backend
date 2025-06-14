import { Controller, Post, Body, Get, Param } from "@nestjs/common";
import { CustomerService } from "./services/customer.service";

@Controller("customers")
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  async getCustomers() {
    return this.customerService.getCustomers();
  }

  @Post("ban")
  async banCustomer(
    @Body() body: { customerId: string; action: "ban" | "unban" }
  ) {
    return this.customerService.banCustomer(body.customerId, body.action);
  }

  @Get(":customerId/chat-history")
  async getCustomerChatHistory(@Param("customerId") customerId: string) {
    return this.customerService.getCustomerChatHistory(customerId);
  }
}
