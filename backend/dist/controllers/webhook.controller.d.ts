import { Request, Response } from "express";
import { WebhookService } from "../services/webhook.service";
export declare class WebhookController {
    private readonly webhookService;
    constructor(webhookService: WebhookService);
    handleWebhookVerification(req: Request, res: Response): Promise<void>;
    handleWebhook(req: Request, res: Response): Promise<void>;
}
