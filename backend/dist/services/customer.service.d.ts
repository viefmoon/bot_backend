export declare class CustomerService {
    banCustomer(clientId: string, action: "ban" | "unban"): Promise<{
        message: string;
        alreadyBanned: boolean;
    }>;
    getCustomers(): Promise<any>;
    getCustomerChatHistory(clientId: string): Promise<any>;
}
