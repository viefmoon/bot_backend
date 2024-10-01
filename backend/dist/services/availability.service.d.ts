import { ToggleAvailabilityDto } from "../dto/toggle-availability.dto";
export declare class AvailabilityService {
    toggleAvailability(toggleAvailabilityDto: ToggleAvailabilityDto): Promise<{
        id: any;
        type: any;
        available: any;
    }>;
}
