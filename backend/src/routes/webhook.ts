import { Router } from 'express';
import express from 'express';
import { WhatsAppService } from '../services/whatsapp';
import { StripeService } from '../services/payment/StripeService';
import logger from '../common/utils/logger';

const router = Router();

// Webhook verification (GET)
router.get('/', (req, res) => {
  try {
    const result = WhatsAppService.verifyWebhook(req.query);
    if (result.verified) {
      res.status(200).send(result.challenge);
    } else {
      res.status(403).send('Forbidden');
    }
  } catch (error) {
    logger.error('Webhook verification error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Webhook handler (POST)
router.post('/', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    // Check if it's a Stripe webhook
    const stripeSignature = req.headers['stripe-signature'];
    
    if (stripeSignature) {
      // Handle Stripe webhook
      await StripeService.handleWebhook(req, res);
    } else {
      // Handle WhatsApp webhook
      await WhatsAppService.handleWebhook(req, res);
    }
  } catch (error) {
    logger.error('Webhook processing error:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default router;