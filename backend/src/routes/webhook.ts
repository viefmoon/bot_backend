import { Router, Request, Response } from 'express';
import express from 'express';
import { WhatsAppService } from '../services/whatsapp';
import { StripeService } from '../services/payment/StripeService';
import { asyncHandler } from '../common/middlewares/errorHandler';

const router = Router();

// Webhook verification (GET)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const result = WhatsAppService.verifyWebhook(req.query);
  if (result.verified) {
    res.status(200).send(result.challenge);
  } else {
    res.status(403).send('Forbidden');
  }
}));

// Webhook handler (POST)
router.post('/', express.raw({ type: '*/*' }), asyncHandler(async (req: Request, res: Response) => {
  // Check if it's a Stripe webhook
  const stripeSignature = req.headers['stripe-signature'];
  
  if (stripeSignature) {
    // Handle Stripe webhook
    await StripeService.handleWebhook(req, res);
  } else {
    // Handle WhatsApp webhook
    await WhatsAppService.handleWebhook(req, res);
  }
}));

export default router;