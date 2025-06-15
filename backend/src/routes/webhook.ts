import { Router } from 'express';
import express from 'express';
import { handleWhatsAppWebhook, verifyWebhook } from '../services/whatsapp';
import { handleStripeWebhook } from '../services/stripe';
import logger from '../utils/logger';

const router = Router();

// Webhook verification (GET)
router.get('/', (req, res) => {
  try {
    const result = verifyWebhook(req.query);
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
      await handleStripeWebhook(req, res);
    } else {
      // Handle WhatsApp webhook
      await handleWhatsAppWebhook(req, res);
    }
  } catch (error) {
    logger.error('Webhook processing error:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default router;