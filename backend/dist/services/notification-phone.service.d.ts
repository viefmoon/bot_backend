export declare class NotificationPhoneService {
    getPhones(): Promise<any>;
    addPhone(phoneNumber: string): Promise<any>;
    updatePhone(id: string, phoneData: {
        phoneNumber: string;
        isActive: boolean;
    }): Promise<any>;
    deletePhone(id: string): Promise<{
        message: string;
    }>;
}
