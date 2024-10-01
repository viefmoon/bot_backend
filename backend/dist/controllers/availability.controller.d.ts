import { AvailabilityService } from "../services/availability.service";
import { ToggleAvailabilityDto } from "../dto/toggle-availability.dto";
export declare class AvailabilityController {
    private readonly availabilityService;
    constructor(availabilityService: AvailabilityService);
    toggleAvailability(toggleAvailabilityDto: ToggleAvailabilityDto): Promise<{
        id: any;
        type: any;
        available: any;
    }>;
}
