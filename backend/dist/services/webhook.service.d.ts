import { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
export declare class WebhookService {
    private configService;
    constructor(configService: ConfigService);
    handleWebhookVerification(req: Request, res: Response): Promise<void>;
    handleStripeWebhook(req: Request, res: Response): Promise<void>;
    handleWhatsAppWebhook(req: Request, res: Response): Promise<void>;
}
