import { Request, Response } from 'express';
import Stripe from 'stripe';
import logger from '../../common/utils/logger';
import { env } from '../../common/config/envValidator';
import { ExternalServiceError, ValidationError, ErrorCode } from '../../common/services/errors';
import { prisma } from '../../server';

/**
 * Service for handling Stripe payment operations
 */
export class StripeService {
  private static stripe: Stripe | null = null;
  private static webhookSecret: string = '';
  private static initialized = false;

  /**
   * Initialize Stripe client (lazy initialization)
   */
  private static initialize(): void {
    if (this.initialized) {
      return;
    }

    try {
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
    } catch (error) {
      logger.error('Failed to initialize Stripe service:', error);
    } finally {
      this.initialized = true;
    }
  }

  /**
   * Check if Stripe is configured
   */
  static isConfigured(): boolean {
    this.initialize();
    return this.stripe !== null;
  }

  /**
   * Handle Stripe webhook
   */
  static async handleWebhook(req: Request, res: Response): Promise<void> {
    this.initialize();
    
    if (!this.stripe) {
      throw new ExternalServiceError(
        ErrorCode.STRIPE_ERROR,
        'Stripe service is not configured'
      );
    }
    
    const sig = req.headers['stripe-signature'] as string;
    
    let event: Stripe.Event;
    
    try {
      event = this.stripe.webhooks.constructEvent(req.body, sig, this.webhookSecret);
    } catch (err: any) {
      throw new ValidationError(
        ErrorCode.WEBHOOK_VERIFICATION_FAILED,
        `Webhook signature verification failed: ${err.message}`
      );
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
  }

  /**
   * Handle completed checkout session
   */
  private static async handleCompletedCheckout(session: Stripe.Checkout.Session): Promise<void> {
    logger.info('Checkout session completed:', session.id);
    
    // Update order with stripe session ID
    if (session.metadata?.orderId) {
      await prisma.order.update({
        where: { id: session.metadata.orderId },
        data: {
          stripeSessionId: session.id
        }
      });
      
      // Create payment record
      await prisma.payment.create({
        data: {
          orderId: session.metadata.orderId,
          amount: session.amount_total! / 100, // Convert from cents
          paymentMethod: 'CREDIT_CARD',
          status: 'PAID',
          stripePaymentId: session.payment_intent as string,
          metadata: {
            sessionId: session.id,
            customerEmail: session.customer_details?.email
          }
        }
      });
      
      logger.info(`Order ${session.metadata.orderId} payment recorded`);
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
    this.initialize();
    
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
    this.initialize();
    
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
    this.initialize();
    
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