import { Controller, Post, Body, Get, Param } from "@nestjs/common";
import { CustomerService } from "../services/customer.service";

@Controller("customers")
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post("ban")
  async banCustomer(
    @Body() body: { clientId: string; action: "ban" | "unban" }
  ) {
    return this.customerService.banCustomer(body.clientId, body.action);
  }

  @Get()
  async getCustomers() {
    return this.customerService.getCustomers();
  }

  @Get(":clientId/chat-history")
  async getCustomerChatHistory(@Param("clientId") clientId: string) {
    return this.customerService.getCustomerChatHistory(clientId);
  }
}