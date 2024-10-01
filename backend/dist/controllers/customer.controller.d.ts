import { CustomerService } from "../services/customer.service";
export declare class CustomerController {
    private readonly customerService;
    constructor(customerService: CustomerService);
    banCustomer(body: {
        clientId: string;
        action: "ban" | "unban";
    }): Promise<{
        message: string;
        alreadyBanned: boolean;
    }>;
    getCustomers(): Promise<any>;
    getCustomerChatHistory(clientId: string): Promise<any>;
}
