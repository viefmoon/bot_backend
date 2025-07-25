/**
 * Payment related interactive message handlers
 */
import { prisma } from '../../../lib/prisma';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
import { sendWhatsAppMessage } from '../../../services/whatsapp';
import Stripe from 'stripe';
import { env } from '../../../common/config/envValidator';
import { BusinessLogicError, ErrorCode } from '../../../common/services/errors';
import { getCurrentMexicoTime } from '../../../common/utils/timeUtils';

const stripeClient = env.STRIPE_SECRET_KEY 
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-10-28.acacia",
    })
  : null;

/**
 * Handle online payment with button ID
 */
export async function handleOnlinePaymentWithId(
  customerId: string,
  buttonId: string
): Promise<void> {
  // Extract orderId from buttonId (format: "pay_online:orderId")
  const [, orderId] = buttonId.split(':');
  if (!orderId) {
    throw new BusinessLogicError(
      ErrorCode.ORDER_NOT_FOUND,
      'Invalid button ID format',
      { userId: customerId, operation: 'handleOnlinePayment' }
    );
  }
  
  return handleOnlinePayment(customerId, orderId);
}

/**
 * Core online payment handler
 */
async function handleOnlinePayment(
  customerId: string,
  orderId: string
): Promise<void> {
  if (!stripeClient) {
    throw new BusinessLogicError(
      ErrorCode.STRIPE_ERROR,
      'Stripe client not configured',
      { userId: customerId, operation: 'handleOnlinePayment' }
    );
  }
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new BusinessLogicError(
        ErrorCode.ORDER_NOT_FOUND,
        'Order not found for payment processing',
        { userId: customerId, operation: 'handleOnlinePayment' }
      );
    }

    // Check if a payment session already exists
    const existingPayment = await prisma.payment.findFirst({
      where: {
        orderId: order.id,
        paymentMethod: PaymentMethod.STRIPE,
        stripePaymentId: { not: null }
      }
    });
    
    if (existingPayment) {
      throw new BusinessLogicError(
        ErrorCode.PAYMENT_LINK_EXISTS,
        'Payment link already exists for this order',
        { userId: customerId, metadata: { orderId: order.id }, operation: 'handleOnlinePayment' }
      );
    }

    // Verificar el estado de la orden
    let mensaje: string | undefined;
    switch (order.orderStatus) {
      case "PENDING":
      case "IN_PROGRESS":
        // Continuar con el proceso de pago
        break;
      case "IN_PREPARATION":
        mensaje =
          "❌ Esta orden ya está en preparación. Por favor, contacta con el restaurante para opciones de pago.";
        break;
      case "READY":
        mensaje =
          "❌ Esta orden ya está preparada. Por favor, contacta con el restaurante para opciones de pago.";
        break;
      case "IN_DELIVERY":
        mensaje =
          "❌ Esta orden ya está en camino. Por favor, paga al repartidor o contacta con el restaurante.";
        break;
      case "CANCELLED":
        mensaje =
          "❌ Esta orden ya ha sido cancelada y no se puede procesar el pago.";
        break;
      case "COMPLETED":
        mensaje =
          "❌ Esta orden ya ha sido finalizada y no se puede procesar el pago.";
        break;
      default:
        mensaje =
          "❌ Lo sentimos, pero no se puede procesar el pago en este momento debido al estado actual de la orden.";
    }

    if (mensaje) {
      // Get customer's WhatsApp phone number
      const customerForMessage = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { whatsappPhoneNumber: true }
      });
      
      if (customerForMessage?.whatsappPhoneNumber) {
        await sendWhatsAppMessage(customerForMessage.whatsappPhoneNumber, mensaje);
      }
      return;
    }

    let customer = await prisma.customer.findUnique({ where: { id: customerId } });
    
    if (!customer) {
      throw new BusinessLogicError(
        ErrorCode.CUSTOMER_NOT_FOUND,
        'Customer not found during payment process'
      );
    }
    
    let stripeCustomerId = customer.stripeCustomerId;

    if (!stripeCustomerId) {
      const stripeCustomer = await stripeClient.customers.create({
        phone: customer.whatsappPhoneNumber,
        metadata: { whatsappId: customer.whatsappPhoneNumber },
      });
      stripeCustomerId = stripeCustomer.id;
      await prisma.customer.update({
        where: { id: customer.id },
        data: { stripeCustomerId }
      });
    }

    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ["card"],
      customer: stripeCustomerId,
      line_items: [
        {
          price_data: {
            currency: "mxn",
            product_data: {
              name: `Orden #${
                order.shiftOrderNumber
              } - ${(await getCurrentMexicoTime()).format("DD/MM/YYYY")}`,
            },
            unit_amount: Math.round(order.total * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${env.FRONTEND_BASE_URL}/payment-success`,
      cancel_url: `${env.FRONTEND_BASE_URL}/payment-cancel`,
    });

    // Create payment record with Stripe session ID
    await prisma.payment.create({
      data: {
        orderId: order.id,
        paymentMethod: PaymentMethod.STRIPE,
        amount: order.total,
        status: PaymentStatus.PENDING,
        stripePaymentId: session.id,
        metadata: {
          sessionUrl: session.url,
          createdAt: new Date().toISOString()
        }
      }
    });

    const paymentLink = session.url;
    await sendWhatsAppMessage(
      customerId,
      `💳 Por favor, haz clic en el siguiente enlace para proceder con el pago: 🔗 ${paymentLink} 💰`
    );
}