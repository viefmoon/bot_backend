import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from "@nestjs/common";
import { NotificationPhoneService } from "../services/notification-phone.service";

@Controller("notification-phones")
export class NotificationPhoneController {
  constructor(
    private readonly notificationPhoneService: NotificationPhoneService
  ) {}

  @Get()
  async getPhones() {
    return this.notificationPhoneService.getPhones();
  }

  @Post()
  async addPhone(@Body() phoneData: { phoneNumber: string }) {
    return this.notificationPhoneService.addPhone(phoneData.phoneNumber);
  }

  @Put(":id")
  async updatePhone(
    @Param("id") id: string,
    @Body() phoneData: { phoneNumber: string; isActive: boolean }
  ) {
    return this.notificationPhoneService.updatePhone(id, phoneData);
  }

  @Delete(":id")
  async deletePhone(@Param("id") id: string) {
    return this.notificationPhoneService.deletePhone(id);
  }
}
