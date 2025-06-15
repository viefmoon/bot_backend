import { Request, Response } from 'express';
import Stripe from 'stripe';
import logger from '../utils/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia'
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function handleStripeWebhook(req: Request, res: Response) {
  try {
    const sig = req.headers['stripe-signature'] as string;
    
    let event: Stripe.Event;
    
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      logger.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCompletedCheckout(session);
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

async function handleCompletedCheckout(session: Stripe.Checkout.Session) {
  try {
    logger.info('Checkout session completed:', session.id);
    
    // Update order payment status
    if (session.metadata?.orderId) {
      const { prisma } = await import('../server');
      
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
  }
}

export async function createCheckoutSession(orderId: number, amount: number, customerPhone: string) {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'mxn',
          product_data: {
            name: `Orden #${orderId}`,
            description: 'Pedido de pizzería'
          },
          unit_amount: Math.round(amount * 100) // Convert to cents
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_BASE_URL}/cancel`,
      metadata: {
        orderId: orderId.toString(),
        customerPhone
      }
    });
    
    return session;
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    throw error;
  }
}