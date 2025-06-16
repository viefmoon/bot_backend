import { Controller, Post, Body } from "@nestjs/common";
import { AvailabilityService } from "../services/availability.service";
import { ToggleAvailabilityDto } from "../dto/toggle-availability.dto";

@Controller("availability")
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Post("toggle")
  async toggleAvailability(
    @Body() toggleAvailabilityDto: ToggleAvailabilityDto
  ) {
    return this.availabilityService.toggleAvailability(toggleAvailabilityDto);
  }
}
