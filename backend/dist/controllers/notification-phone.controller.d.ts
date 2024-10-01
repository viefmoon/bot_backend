import { NotificationPhoneService } from "../services/notification-phone.service";
export declare class NotificationPhoneController {
    private readonly notificationPhoneService;
    constructor(notificationPhoneService: NotificationPhoneService);
    getPhones(): Promise<any>;
    addPhone(phoneData: {
        phoneNumber: string;
    }): Promise<any>;
    updatePhone(id: string, phoneData: {
        phoneNumber: string;
        isActive: boolean;
    }): Promise<any>;
    deletePhone(id: string): Promise<{
        message: string;
    }>;
}
