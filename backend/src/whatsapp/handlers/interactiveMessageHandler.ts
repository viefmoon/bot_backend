import { handleOrderCancellation } from "./orders/cancellationHandler";
import { PreOrderWorkflowService } from "../../services/orders/PreOrderWorkflowService";
import { PreOrderActionParams } from "../../common/types/preorder.types";

import { prisma } from "../../server";
import { sendWhatsAppMessage, sendMessageWithUrlButton } from "../../services/whatsapp";
import Stripe from "stripe";
import { OTPService } from "../../services/security/OTPService";
import {
  WAIT_TIMES_MESSAGE,
  RESTAURANT_INFO_MESSAGE,
  CHATBOT_HELP_MESSAGE,
} from "../../common/config/predefinedMessages";
import { ConfigService } from "../../services/config/ConfigService";
import { ProductService } from "../../services/products/ProductService";
import logger from "../../common/utils/logger";
import { getCurrentMexicoTime, getFormattedBusinessHours } from "../../common/utils/timeUtils";
import { env } from "../../common/config/envValidator";
import { ErrorService, BusinessLogicError, ErrorCode } from "../../common/services/errors";

const stripeClient = env.STRIPE_SECRET_KEY 
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-10-28.acacia",
    })
  : null;

// ProductService uses static methods, no need to instantiate

// Map of button action prefixes to their handlers
const BUTTON_ACTION_HANDLERS = new Map<string, (from: string, buttonId: string) => Promise<void>>([  
  ['preorder_confirm', handlePreOrderAction],
  ['preorder_discard', handlePreOrderAction],
]);

const LIST_ACTIONS = {
  cancel_order: handleOrderCancellation,
  pay_online: handleOnlinePayment,
  wait_times: handleWaitTimes,
  view_menu: sendMenu,
  restaurant_info: handleRestaurantInfo,
  chatbot_help: handleChatbotHelp,
  change_delivery_info: handleChangeDeliveryInfo,
} as const;

export async function handleInteractiveMessage(
  from: string,
  message: any
): Promise<void> {
  try {
    logger.info('Interactive message received:', JSON.stringify(message));
    
    if (!message.interactive) {
      logger.error('No interactive property in message');
      return;
    }
    
    const { type, button_reply, list_reply } = message.interactive;
    const messageId = message.context?.id || null;

    if (type === "button_reply") {
      // Check for address confirmation
      if (button_reply.id.startsWith('confirm_address_')) {
        await handleAddressConfirmation(from, button_reply.id, messageId);
      } else if (button_reply.id === 'change_address') {
        await handleChangeDeliveryInfo(from);
      } else {
        // Check for action handlers by prefix
        const [actionPrefix] = button_reply.id.split(':');
        const handler = BUTTON_ACTION_HANDLERS.get(actionPrefix);
        
        if (handler) {
          await handler(from, button_reply.id);
        } else {
          logger.warn(`No handler found for button action: ${button_reply.id}`);
        }
      }
    } else if (type === "list_reply") {
      // Check for address selection
      if (list_reply.id.startsWith('select_address_')) {
        await handleAddressSelection(from, list_reply.id, messageId);
      } else if (list_reply.id === 'add_new_address') {
        await handleAddNewAddress(from, messageId);
      } else {
        const action = LIST_ACTIONS[list_reply.id as keyof typeof LIST_ACTIONS];
        if (action) {
          logger.info(`Executing action: ${list_reply.id}`);
          await action(from, messageId);
        } else {
          logger.error(`No action found for: ${list_reply.id}`);
        }
      }
    }
  } catch (error) {
    await ErrorService.handleAndSendError(error, from, {
      userId: from,
      operation: 'handleInteractiveMessage'
    });
  }
}


async function handleOnlinePayment(
  customerId: string,
  messageId: string
): Promise<void> {
  try {
    if (!stripeClient) {
      throw new BusinessLogicError(
        ErrorCode.STRIPE_ERROR,
        'Stripe client not configured',
        { userId: customerId, operation: 'handleOnlinePayment' }
      );
    }
    const order = await prisma.order.findFirst({ where: { messageId } });
    if (!order) {
      throw new BusinessLogicError(
        ErrorCode.ORDER_NOT_FOUND,
        'Order not found for payment processing',
        { userId: customerId, operation: 'handleOnlinePayment' }
      );
    }

    if (order.stripeSessionId || order.paymentStatus === "PENDING") {
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
      await sendWhatsAppMessage(customerId, "❌ Error al procesar el pago. Cliente no encontrado.");
      return;
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
                order.dailyNumber
              } - ${(await getCurrentMexicoTime()).format("DD/MM/YYYY")}`,
            },
            unit_amount: Math.round(order.totalCost * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${env.FRONTEND_BASE_URL}/payment-success`,
      cancel_url: `${env.FRONTEND_BASE_URL}/payment-cancel`,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        stripeSessionId: session.id,
        paymentStatus: "PENDING",
      }
    });

    const paymentLink = session.url;
    await sendWhatsAppMessage(
      customerId,
      `💳 Por favor, haz clic en el siguiente enlace para proceder con el pago: 🔗 ${paymentLink} 💰`
    );
    // await sendWhatsAppNotification("Se ha generado un link de pago");
  } catch (error) {
    await ErrorService.handleAndSendError(error, customerId, {
      userId: customerId,
      operation: 'handleOnlinePayment',
      metadata: { messageId }
    });
  }
}

async function sendMenu(phoneNumber: string): Promise<boolean> {
  try {
    const fullMenu = await ProductService.getActiveProducts({ formatForAI: true });
    // La utilidad messageSender se encarga de dividir mensajes largos automáticamente
    const success = await sendWhatsAppMessage(phoneNumber, String(fullMenu));
    return success;
  } catch (error) {
    await ErrorService.handleAndSendError(error, phoneNumber, {
      userId: phoneNumber,
      operation: 'sendMenu'
    });
    return false;
  }
}

async function handleWaitTimes(customerId: string): Promise<void> {
  try {
    const config = await prisma.restaurantConfig.findFirst();
    if (!config) {
      throw new BusinessLogicError(ErrorCode.DATABASE_ERROR, 'Restaurant configuration not found');
    }
    const message = WAIT_TIMES_MESSAGE(
      config.estimatedPickupTime,
      config.estimatedDeliveryTime
    );
    await sendWhatsAppMessage(customerId, message);
  } catch (error) {
    await ErrorService.handleAndSendError(error, customerId, {
      userId: customerId,
      operation: 'handleWaitTimes'
    });
  }
}

async function handleRestaurantInfo(customerId: string): Promise<void> {
  try {
    const config = ConfigService.getConfig();
    const formattedHours = await getFormattedBusinessHours();
    const message = RESTAURANT_INFO_MESSAGE(config, formattedHours);
    await sendWhatsAppMessage(customerId, message);
  } catch (error) {
    await ErrorService.handleAndSendError(error, customerId, {
      userId: customerId,
      operation: 'handleRestaurantInfo'
    });
  }
}

async function handleChatbotHelp(whatsappPhoneNumber: string): Promise<void> {
  try {
    const config = ConfigService.getConfig();
    const message = CHATBOT_HELP_MESSAGE(config);
    await sendWhatsAppMessage(whatsappPhoneNumber, message);
  } catch (error) {
    await ErrorService.handleAndSendError(error, whatsappPhoneNumber, {
      userId: whatsappPhoneNumber,
      operation: 'handleChatbotHelp'
    });
  }
}

async function handleChangeDeliveryInfo(from: string): Promise<void> {
  const otp = OTPService.generateOTP();
  await OTPService.storeOTP(from, otp, true); // true for address registration
  const updateLink = `${env.FRONTEND_BASE_URL}/address-registration/${from}?otp=${otp}`;
  
  // Enviar mensaje con botón URL
  await sendMessageWithUrlButton(
    from,
    "🚚 Actualizar Dirección",
    "Puedes actualizar o agregar una nueva dirección de entrega haciendo clic en el botón de abajo.",
    "Actualizar Dirección",
    updateLink
  );
}

async function handleAddressConfirmation(from: string, confirmationId: string, messageId: string): Promise<void> {
  try {
    // Extract address ID from confirmation ID
    const addressId = confirmationId.replace('confirm_address_', '');
    
    // This is the same as selecting an address
    await handleAddressSelection(from, `select_address_${addressId}`, messageId);
    
  } catch (error) {
    await ErrorService.handleAndSendError(error, from, {
      userId: from,
      operation: 'handleAddressConfirmation'
    });
  }
}

async function handleAddressSelection(from: string, selectionId: string, messageId: string): Promise<void> {
  try {
    // Extract address ID from selection ID
    const addressId = selectionId.replace('select_address_', '');
    
    // Get customer
    const customer = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: from },
      include: {
        addresses: {
          where: { id: addressId }
        }
      }
    });
    
    if (!customer || customer.addresses.length === 0) {
      throw new BusinessLogicError(
        ErrorCode.CUSTOMER_NOT_FOUND,
        'Customer or address not found',
        { userId: from }
      );
    }
    
    const selectedAddress = customer.addresses[0];
    
    // Format address for confirmation
    const addressParts = [];
    if (selectedAddress.street && selectedAddress.number) {
      let streetLine = `${selectedAddress.street} ${selectedAddress.number}`;
      if (selectedAddress.interiorNumber) {
        streetLine += ` Int. ${selectedAddress.interiorNumber}`;
      }
      addressParts.push(streetLine);
    }
    if (selectedAddress.neighborhood) addressParts.push(selectedAddress.neighborhood);
    if (selectedAddress.city && selectedAddress.state) {
      addressParts.push(`${selectedAddress.city}, ${selectedAddress.state}`);
    }
    if (selectedAddress.references) {
      addressParts.push(`Referencias: ${selectedAddress.references}`);
    }
    
    const formattedAddress = addressParts.join('\n');
    
    // Check if this is for a preorder
    const preOrder = await prisma.preOrder.findFirst({
      where: { 
        whatsappPhoneNumber: customer.whatsappPhoneNumber,
        messageId: { contains: messageId }
      }
    });
    
    if (preOrder) {
      // Update preorder with selected address
      const axios = (await import('axios')).default;
      await axios.post(`${process.env.BACKEND_BASE_URL || 'http://localhost:3001'}/backend/address-selection/update`, {
        preOrderId: preOrder.id,
        addressId: selectedAddress.id,
        customerId: customer.id
      });
      
      await sendWhatsAppMessage(
        from,
        `✅ *Dirección seleccionada exitosamente*\n\n📍 *Dirección de entrega:*\n${formattedAddress}\n\nTu pedido será entregado en esta dirección.`
      );
    } else {
      // Just confirming address selection
      await sendWhatsAppMessage(
        from,
        `✅ *Dirección seleccionada*\n\n📍 *Dirección de entrega:*\n${formattedAddress}\n\nEsta dirección se usará para tu próximo pedido.`
      );
    }
    
  } catch (error) {
    await ErrorService.handleAndSendError(error, from, {
      userId: from,
      operation: 'handleAddressSelection'
    });
  }
}

async function handleAddNewAddress(from: string, messageId: string): Promise<void> {
  try {
    // Get customer
    const customer = await prisma.customer.findUnique({
      where: { whatsappPhoneNumber: from }
    });
    
    if (!customer) {
      throw new BusinessLogicError(
        ErrorCode.CUSTOMER_NOT_FOUND,
        'Customer not found',
        { userId: from }
      );
    }
    
    // Check if this is for a preorder
    const preOrder = await prisma.preOrder.findFirst({
      where: { 
        whatsappPhoneNumber: customer.whatsappPhoneNumber,
        messageId: { contains: messageId }
      }
    });
    
    const otp = OTPService.generateOTP();
    await OTPService.storeOTP(customer.whatsappPhoneNumber, otp, true);
    
    const updateLink = `${env.FRONTEND_BASE_URL}/address-registration/${customer.whatsappPhoneNumber}?otp=${otp}${preOrder ? `&preOrderId=${preOrder.id}` : ''}`;
    
    await sendMessageWithUrlButton(
      from,
      "📍 Agregar Nueva Dirección",
      "Haz clic en el botón de abajo para registrar una nueva dirección de entrega.",
      "Agregar Dirección",
      updateLink
    );
    
  } catch (error) {
    await ErrorService.handleAndSendError(error, from, {
      userId: from,
      operation: 'handleAddNewAddress'
    });
  }
}

/**
 * Handles preorder actions (confirm/discard) using the new token-based system
 */
async function handlePreOrderAction(from: string, buttonId: string): Promise<void> {
  try {
    // Extract action and token from button ID
    // Format: preorder_confirm:token or preorder_discard:token
    const [actionType, token] = buttonId.split(':');
    
    if (!token) {
      throw new BusinessLogicError(
        ErrorCode.INVALID_TOKEN,
        'Invalid button format - missing token'
      );
    }
    
    // Determine action based on button prefix
    const action: 'confirm' | 'discard' = actionType === 'preorder_confirm' ? 'confirm' : 'discard';
    
    logger.info('Processing preorder action', { 
      from, 
      action, 
      tokenPrefix: token.substring(0, 8) + '...' 
    });
    
    // Process the action using the workflow service
    await PreOrderWorkflowService.processAction({
      action,
      token,
      whatsappNumber: from
    });
    
  } catch (error) {
    await ErrorService.handleAndSendError(error, from, {
      userId: from,
      operation: 'handlePreOrderAction'
    });
  }
}
