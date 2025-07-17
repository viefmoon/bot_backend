import { handleOrderCancellation } from "./orders/cancellationHandler";
import { PreOrderWorkflowService } from "../../services/orders/PreOrderWorkflowService";
import { INTERACTIVE_ACTIONS, startsWithAction, extractIdFromAction } from "../../common/constants/interactiveActions";
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
import { BusinessLogicError, ErrorCode } from "../../common/services/errors";
import { handleWhatsAppError } from "../../common/utils/whatsappErrorHandler";

const stripeClient = env.STRIPE_SECRET_KEY 
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-10-28.acacia",
    })
  : null;

// ProductService uses static methods, no need to instantiate

// Map of button action prefixes to their handlers
const BUTTON_ACTION_HANDLERS = new Map<string, (from: string, buttonId: string) => Promise<void>>([  
  [INTERACTIVE_ACTIONS.PREORDER_CONFIRM.slice(0, -1), handlePreOrderAction], // Remove trailing colon
  [INTERACTIVE_ACTIONS.PREORDER_DISCARD.slice(0, -1), handlePreOrderAction], // Remove trailing colon
]);

const LIST_ACTIONS = {
  [INTERACTIVE_ACTIONS.CANCEL_ORDER]: handleOrderCancellation,
  [INTERACTIVE_ACTIONS.PAY_ONLINE]: handleOnlinePayment,
  [INTERACTIVE_ACTIONS.WAIT_TIMES]: handleWaitTimes,
  [INTERACTIVE_ACTIONS.VIEW_MENU]: sendMenu,
  [INTERACTIVE_ACTIONS.RESTAURANT_INFO]: handleRestaurantInfo,
  [INTERACTIVE_ACTIONS.CHATBOT_HELP]: handleChatbotHelp,
  [INTERACTIVE_ACTIONS.CHANGE_DELIVERY_INFO]: handleChangeDeliveryInfo,
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
      if (startsWithAction(button_reply.id, INTERACTIVE_ACTIONS.CONFIRM_ADDRESS)) {
        await handleAddressConfirmation(from, button_reply.id, messageId);
      } else if (button_reply.id === INTERACTIVE_ACTIONS.CHANGE_ADDRESS) {
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
      if (startsWithAction(list_reply.id, INTERACTIVE_ACTIONS.SELECT_ADDRESS)) {
        await handleAddressSelection(from, list_reply.id, messageId);
      } else if (list_reply.id === INTERACTIVE_ACTIONS.ADD_NEW_ADDRESS) {
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
    await handleWhatsAppError(error, from, {
      userId: from,
      operation: 'handleInteractiveMessage'
    });
  }
}


async function handleOnlinePayment(
  customerId: string,
  messageId: string
): Promise<void> {
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

    if (order.stripeSessionId) {
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
                order.dailyNumber
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

    await prisma.order.update({
      where: { id: order.id },
      data: {
        stripeSessionId: session.id,
      }
    });

    const paymentLink = session.url;
    await sendWhatsAppMessage(
      customerId,
      `💳 Por favor, haz clic en el siguiente enlace para proceder con el pago: 🔗 ${paymentLink} 💰`
    );
}

async function sendMenu(phoneNumber: string): Promise<boolean> {
  const fullMenu = await ProductService.getActiveProducts({ formatForAI: true });
  // La utilidad messageSender se encarga de dividir mensajes largos automáticamente
  const success = await sendWhatsAppMessage(phoneNumber, String(fullMenu));
  return success;
}

async function handleWaitTimes(customerId: string): Promise<void> {
  const config = await prisma.restaurantConfig.findFirst();
  if (!config) {
    throw new BusinessLogicError(ErrorCode.DATABASE_ERROR, 'Restaurant configuration not found');
  }
  const message = WAIT_TIMES_MESSAGE(
    config.estimatedPickupTime,
    config.estimatedDeliveryTime
  );
  await sendWhatsAppMessage(customerId, message);
}

async function handleRestaurantInfo(customerId: string): Promise<void> {
  const config = ConfigService.getConfig();
  const formattedHours = await getFormattedBusinessHours();
  const message = RESTAURANT_INFO_MESSAGE(config, formattedHours);
  await sendWhatsAppMessage(customerId, message);
}

async function handleChatbotHelp(whatsappPhoneNumber: string): Promise<void> {
  const config = ConfigService.getConfig();
  const message = CHATBOT_HELP_MESSAGE(config);
  await sendWhatsAppMessage(whatsappPhoneNumber, message);
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
  // Extract address ID from confirmation ID
  const addressId = extractIdFromAction(confirmationId, INTERACTIVE_ACTIONS.CONFIRM_ADDRESS);
  
  // This is the same as selecting an address
  await handleAddressSelection(from, `${INTERACTIVE_ACTIONS.SELECT_ADDRESS}${addressId}`, messageId);
}

async function handleAddressSelection(from: string, selectionId: string, messageId: string): Promise<void> {
  // Extract address ID from selection ID
  const addressId = extractIdFromAction(selectionId, INTERACTIVE_ACTIONS.SELECT_ADDRESS);
    
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
    if (selectedAddress.deliveryInstructions) {
      addressParts.push(`Referencias: ${selectedAddress.deliveryInstructions}`);
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
      await axios.post(`${env.FRONTEND_BASE_URL}/backend/address-selection/update`, {
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
}

async function handleAddNewAddress(from: string, messageId: string): Promise<void> {
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
}

/**
 * Handles preorder actions (confirm/discard) using the new token-based system
 */
async function handlePreOrderAction(from: string, buttonId: string): Promise<void> {
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
    const action: 'confirm' | 'discard' = 
      startsWithAction(buttonId, INTERACTIVE_ACTIONS.PREORDER_CONFIRM) ? 'confirm' : 'discard';
    
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
}
