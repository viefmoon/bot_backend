import { Request, Response } from 'express';
import Stripe from 'stripe';
import logger from '../../common/utils/logger';
import { env } from '../../common/config/envValidator';
import { ExternalServiceError, ErrorCode } from '../../common/services/errors';
import { prisma } from '../../server';

/**
 * Service for handling Stripe payment operations
 */
export class StripeService {
  private static stripe: Stripe | null = null;
  private static webhookSecret: string = '';

  /**
   * Initialize Stripe client
   */
  static {
    const stripeKey = env.STRIPE_SECRET_KEY;
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, {
        apiVersion: '2024-10-28.acacia'
      });
      this.webhookSecret = env.STRIPE_WEBHOOK_SECRET || '';
      logger.info('Stripe service initialized');
    } else {
      logger.warn('Stripe service not configured - missing STRIPE_SECRET_KEY');
    }
  }

  /**
   * Check if Stripe is configured
   */
  static isConfigured(): boolean {
    return this.stripe !== null;
  }

  /**
   * Handle Stripe webhook
   */
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    if (!this.stripe) {
      logger.warn('Stripe webhook called but Stripe is not configured');
      res.status(503).json({ error: 'Stripe service unavailable' });
      return;
    }
    
    try {
      const sig = req.headers['stripe-signature'] as string;
      
      let event: Stripe.Event;
      
      try {
        event = this.stripe.webhooks.constructEvent(req.body, sig, this.webhookSecret);
      } catch (err: any) {
        logger.error('Webhook signature verification failed:', err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
      }
      
      // Handle the event
      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object as Stripe.Checkout.Session;
          await this.handleCompletedCheckout(session);
          break;
          
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          logger.info('Payment succeeded:', paymentIntent.id);
          break;
          
        default:
          logger.info(`Unhandled event type ${event.type}`);
      }
      
      res.json({ received: true });
    } catch (error) {
      logger.error('Error handling Stripe webhook:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  /**
   * Handle completed checkout session
   */
  private static async handleCompletedCheckout(session: Stripe.Checkout.Session): Promise<void> {
    try {
      logger.info('Checkout session completed:', session.id);
      
      // Update order payment status
      if (session.metadata?.orderId) {
        await prisma.order.update({
          where: { id: parseInt(session.metadata.orderId) },
          data: {
            paymentStatus: 'paid',
            stripeSessionId: session.id
          }
        });
        
        logger.info(`Order ${session.metadata.orderId} marked as paid`);
      }
    } catch (error) {
      logger.error('Error handling completed checkout:', error);
      throw new ExternalServiceError(
        ErrorCode.STRIPE_ERROR,
        'Failed to handle completed checkout',
        { metadata: { sessionId: session.id } }
      );
    }
  }

  /**
   * Create a checkout session for an order
   */
  static async createCheckoutSession(
    orderId: number, 
    amount: number, 
    customerPhone: string
  ): Promise<Stripe.Checkout.Session> {
    if (!this.stripe) {
      throw new ExternalServiceError(
        ErrorCode.STRIPE_ERROR,
        'Stripe service is not configured',
        { metadata: { orderId } }
      );
    }

    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'mxn',
            product_data: {
              name: `Orden #${orderId}`,
              description: 'Pedido de establecimiento'
            },
            unit_amount: Math.round(amount * 100) // Convert to cents
          },
          quantity: 1
        }],
        mode: 'payment',
        success_url: `${env.FRONTEND_BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.FRONTEND_BASE_URL}/cancel`,
        metadata: {
          orderId: orderId.toString(),
          customerPhone
        }
      });
      
      logger.info(`Created checkout session ${session.id} for order ${orderId}`);
      return session;
    } catch (error) {
      logger.error('Error creating checkout session:', error);
      throw new ExternalServiceError(
        ErrorCode.STRIPE_ERROR,
        'Failed to create checkout session',
        { metadata: { orderId, amount } }
      );
    }
  }

  /**
   * Get checkout session by ID
   */
  static async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session | null> {
    if (!this.stripe) {
      throw new ExternalServiceError(
        ErrorCode.STRIPE_ERROR,
        'Stripe service is not configured',
        { metadata: { sessionId } }
      );
    }

    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      return session;
    } catch (error) {
      logger.error('Error retrieving checkout session:', error);
      return null;
    }
  }

  /**
   * Cancel payment intent
   */
  static async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    if (!this.stripe) {
      throw new ExternalServiceError(
        ErrorCode.STRIPE_ERROR,
        'Stripe service is not configured',
        { metadata: { paymentIntentId } }
      );
    }

    try {
      await this.stripe.paymentIntents.cancel(paymentIntentId);
      logger.info(`Cancelled payment intent ${paymentIntentId}`);
    } catch (error) {
      logger.error('Error cancelling payment intent:', error);
      throw new ExternalServiceError(
        ErrorCode.STRIPE_ERROR,
        'Failed to cancel payment intent',
        { metadata: { paymentIntentId } }
      );
    }
  }
}