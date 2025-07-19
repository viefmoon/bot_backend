import { PreOrderWorkflowService } from "../../services/orders/PreOrderWorkflowService";
import { INTERACTIVE_ACTIONS, startsWithAction, extractIdFromAction } from "../../common/constants/interactiveActions";
import { prisma } from '../../lib/prisma';
import { sendWhatsAppMessage, sendMessageWithUrlButton, WhatsAppService } from "../../services/whatsapp";
import Stripe from "stripe";
import { OTPService } from "../../services/security/OTPService";
import { redisService } from "../../services/redis/RedisService";
import { redisKeys } from "../../common/constants";
import {
  WAIT_TIMES_MESSAGE,
  RESTAURANT_INFO_MESSAGE,
  CHATBOT_HELP_MESSAGE,
} from "../../common/config/predefinedMessages";
import { ConfigService } from "../../services/config/ConfigService";
import logger from "../../common/utils/logger";
import { getCurrentMexicoTime, getFormattedBusinessHours } from "../../common/utils/timeUtils";
import { env } from "../../common/config/envValidator";
import { BusinessLogicError, ErrorCode } from "../../common/services/errors";
import { handleWhatsAppError } from "../../common/utils/whatsappErrorHandler";
import { getMenuResponses } from "../../services/ai/tools/handlers/sendMenuHandler";
import { formatAddressFull, formatAddressShort, formatAddressDescription } from "../../common/utils/addressFormatter";

const stripeClient = env.STRIPE_SECRET_KEY 
  ? new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-10-28.acacia",
    })
  : null;

// Unified action registry for all interactive messages
const actionRegistry = new Map<string, (from: string, id: string) => Promise<void>>([
  // List actions (exact match)
  [INTERACTIVE_ACTIONS.WAIT_TIMES, async (from, id) => handleWaitTimes(from)],
  [INTERACTIVE_ACTIONS.VIEW_MENU, async (from, id) => sendMenu(from)],
  [INTERACTIVE_ACTIONS.RESTAURANT_INFO, async (from, id) => handleRestaurantInfo(from)],
  [INTERACTIVE_ACTIONS.CHATBOT_HELP, async (from, id) => handleChatbotHelp(from)],
  [INTERACTIVE_ACTIONS.CHANGE_DELIVERY_INFO, async (from, id) => handleChangeDeliveryInfo(from)],
  [INTERACTIVE_ACTIONS.ADD_NEW_ADDRESS, async (from, id) => handleAddNewAddress(from)],
  
  // Button actions (prefix match - remove trailing colon)
  [INTERACTIVE_ACTIONS.PREORDER_CONFIRM.slice(0, -1), handlePreOrderAction],
  [INTERACTIVE_ACTIONS.PREORDER_DISCARD.slice(0, -1), handlePreOrderAction],
  [INTERACTIVE_ACTIONS.PREORDER_CHANGE_ADDRESS.slice(0, -1), handlePreOrderChangeAddress],
  [INTERACTIVE_ACTIONS.CONFIRM_ADDRESS.slice(0, -1), handleAddressConfirmation],
  [INTERACTIVE_ACTIONS.SELECT_ADDRESS.slice(0, -1), handleAddressSelection],
  ['pay_online', handleOnlinePaymentWithId],
  ['add_new_address_preorder', async (from, id) => {
    // Special case: parse preOrderId from id
    if (id.includes(':')) {
      const preOrderId = parseInt(id.split(':')[1], 10);
      await handleAddNewAddressForPreOrder(from, preOrderId);
    } else {
      await handleAddNewAddressFromButton(from, id);
    }
  }],
  ['select_address', handleAddressSelectionButton],
  
  // Special case handlers with full ID
  [INTERACTIVE_ACTIONS.CHANGE_ADDRESS, async (from, id) => handleChangeDeliveryInfo(from)],
]);

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
    
    const reply = message.interactive.button_reply || message.interactive.list_reply;
    if (!reply) {
      logger.error('No reply found in interactive message');
      return;
    }

    const { id } = reply;
    logger.info(`Processing interactive reply: ${id}`);
    
    // First, try exact match
    let handler = actionRegistry.get(id);
    
    // If no exact match, try prefix match for actions with parameters
    if (!handler) {
      const [actionPrefix] = id.split(':');
      handler = actionRegistry.get(actionPrefix);
      
      // Special handling for actions that start with a prefix
      if (!handler && id.includes(':')) {
        // Check for actions that use startsWithAction pattern
        for (const [key, value] of actionRegistry) {
          if (id.startsWith(key + ':')) {
            handler = value;
            break;
          }
        }
      }
    }
    
    if (handler) {
      logger.info(`Executing handler for action: ${id}`);
      await handler(from, id);
    } else {
      logger.warn(`No handler found for interactive action: ${id}`);
    }
  } catch (error) {
    await handleWhatsAppError(error, from, {
      userId: from,
      operation: 'handleInteractiveMessage'
    });
  }
}



async function handleOnlinePaymentWithId(
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
        paymentMethod: 'STRIPE',
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
        paymentMethod: 'STRIPE',
        amount: order.total,
        status: 'PENDING',
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

async function sendMenu(phoneNumber: string): Promise<void> {
  // No hay try...catch aquí. Si algo falla, el error sube al manejador principal.
  
  // Usa la lógica centralizada para obtener y dividir el menú
  const toolResponse = await getMenuResponses();
  
  // Normaliza a array para manejar ambos casos (respuesta única o múltiple)
  const responses = Array.isArray(toolResponse) ? toolResponse : [toolResponse];
  
  // Envía cada parte del menú por separado
  // La división ya fue manejada por getMenuResponses usando splitMenu
  for (const response of responses) {
    if (response && response.content?.text) {
      // sendWhatsAppMessage no volverá a dividir porque cada parte es < 3500 chars
      const result = await sendWhatsAppMessage(phoneNumber, response.content.text);
      if (!result) {
        // Lanza un error para que el manejador principal lo capture
        throw new BusinessLogicError(
          ErrorCode.WHATSAPP_ERROR,
          `Failed to send menu part to ${phoneNumber}`
        );
      }
    }
  }
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

async function handleAddressConfirmation(from: string, confirmationId: string): Promise<void> {
  // Extract address ID from confirmation ID
  const addressId = extractIdFromAction(confirmationId, INTERACTIVE_ACTIONS.CONFIRM_ADDRESS);
  
  // This is the same as selecting an address
  await handleAddressSelection(from, `${INTERACTIVE_ACTIONS.SELECT_ADDRESS}${addressId}`);
}

async function handleAddressSelection(from: string, selectionId: string): Promise<void> {
  // Check if this is from a preorder change address flow
  // Format can be: select_address_[addressId] or select_address_[addressId]:[preOrderId]
  let addressId: string;
  let preOrderId: number | null = null;
  
  if (selectionId.includes(':')) {
    // This is from preorder change address flow
    const baseId = selectionId.split(':')[0];
    addressId = extractIdFromAction(baseId, INTERACTIVE_ACTIONS.SELECT_ADDRESS);
    preOrderId = parseInt(selectionId.split(':')[1], 10);
  } else {
    // Regular address selection
    addressId = extractIdFromAction(selectionId, INTERACTIVE_ACTIONS.SELECT_ADDRESS);
  }
    
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
    const formattedAddress = formatAddressFull(selectedAddress);
    
    // If we have a specific preOrderId, use it. Otherwise, check for recent preorder
    if (preOrderId) {
      // Recreate preorder with selected address
      const { PreOrderWorkflowService } = await import('../../services/orders/PreOrderWorkflowService');
      
      try {
        // This will create a new preOrder with the new address and discard the old one
        await PreOrderWorkflowService.recreatePreOrderWithNewAddress({
          oldPreOrderId: preOrderId,
          newAddressId: selectedAddress.id,
          whatsappNumber: from
        });
        
        // The new preOrder summary is automatically sent by recreatePreOrderWithNewAddress
        // No need to send additional messages
      } catch (error) {
        logger.error('Error recreating preOrder with new address:', error);
        await sendWhatsAppMessage(
          from,
          `❌ Hubo un error al actualizar la dirección. Por favor intenta nuevamente.`
        );
      }
    } else {
      // No preOrderId provided, just confirming address selection for future use
      await sendWhatsAppMessage(
        from,
        `✅ *Dirección seleccionada*\n\n📍 *Dirección de entrega:*\n${formattedAddress}\n\nEsta dirección se usará para tu próximo pedido.`
      );
    }
}

async function handleAddNewAddress(from: string): Promise<void> {
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
    
  const preOrder = await prisma.preOrder.findFirst({
    where: { 
      whatsappPhoneNumber: customer.whatsappPhoneNumber,
      createdAt: {
        gte: new Date(Date.now() - 10 * 60 * 1000)
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  const otp = OTPService.generateOTP();
  await OTPService.storeOTP(customer.whatsappPhoneNumber, otp, true);
  
  const updateLink = `${env.FRONTEND_BASE_URL}/address-registration/${customer.whatsappPhoneNumber}?otp=${otp}${preOrder ? `&preOrderId=${preOrder.id}` : ''}&viewMode=form`;
  
  await sendMessageWithUrlButton(
    from,
    "📍 Agregar Nueva Dirección",
    "Haz clic en el botón de abajo para registrar una nueva dirección de entrega.",
    "Agregar Dirección",
    updateLink
  );
}

async function handleAddNewAddressForPreOrder(from: string, preOrderId: number): Promise<void> {
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
  
  const otp = OTPService.generateOTP();
  await OTPService.storeOTP(customer.whatsappPhoneNumber, otp, true);
  
  const updateLink = `${env.FRONTEND_BASE_URL}/address-registration/${customer.whatsappPhoneNumber}?otp=${otp}&preOrderId=${preOrderId}&viewMode=form`;
  
  await sendMessageWithUrlButton(
    from,
    "📍 Agregar Nueva Dirección",
    "Haz clic en el botón de abajo para registrar una nueva dirección de entrega para tu pedido actual.",
    "Agregar Dirección",
    updateLink
  );
}

/**
 * Handler for add new address button (from button reply)
 */
async function handleAddNewAddressFromButton(from: string, buttonId: string): Promise<void> {
  const parts = buttonId.split(':');
  if (parts.length < 2) {
    await sendWhatsAppMessage(from, "❌ Error al procesar la solicitud. Por favor intenta nuevamente.");
    return;
  }
  
  const preOrderId = parseInt(parts[1], 10);
  if (isNaN(preOrderId)) {
    await sendWhatsAppMessage(from, "❌ Error al procesar la solicitud. Por favor intenta nuevamente.");
    return;
  }
  
  await handleAddNewAddressForPreOrder(from, preOrderId);
}

/**
 * Handler for address selection button (from button reply)
 */
async function handleAddressSelectionButton(from: string, buttonId: string): Promise<void> {
  await handleAddressSelection(from, buttonId);
}

/**
 * Handles preorder change address action
 */
async function handlePreOrderChangeAddress(from: string, buttonId: string): Promise<void> {
  // Extract token from button ID
  const parts = buttonId.split(':');
  const token = parts[1];
  
  if (!token) {
    throw new BusinessLogicError(
      ErrorCode.INVALID_TOKEN,
      'Invalid button format - missing token'
    );
  }
  
  // Validate token and get preOrderId
  const key = redisKeys.preorderToken(token);
  const preOrderIdStr = await redisService.get(key);
  
  if (!preOrderIdStr) {
    throw new BusinessLogicError(
      ErrorCode.INVALID_TOKEN,
      'Token no encontrado o expirado'
    );
  }
  
  const preOrderId = parseInt(preOrderIdStr, 10);
  
  // Get customer
  const customer = await prisma.customer.findUnique({
    where: { whatsappPhoneNumber: from },
    include: {
      addresses: {
        where: { deletedAt: null },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' }
        ],
        take: 5
      }
    }
  });
  
  if (!customer) {
    throw new BusinessLogicError(
      ErrorCode.CUSTOMER_NOT_FOUND,
      'Customer not found'
    );
  }
  
  // If no addresses, send link to add one
  if (customer.addresses.length === 0) {
    const otp = OTPService.generateOTP();
    await OTPService.storeOTP(from, otp, true);
    const updateLink = `${env.FRONTEND_BASE_URL}/address-registration/${from}?otp=${otp}&preOrderId=${preOrderId}`;
    
    await sendMessageWithUrlButton(
      from,
      "📍 Registrar Dirección",
      "No tienes direcciones guardadas. Por favor, registra una dirección de entrega haciendo clic en el botón de abajo.",
      "Agregar Dirección",
      updateLink
    );
    return;
  }
  
  // If only one address, offer to add a new one
  if (customer.addresses.length === 1) {
    const message = {
      type: "button",
      body: {
        text: `📍 *Dirección actual:*\n${formatAddressShort(customer.addresses[0])}\n\n¿Deseas usar esta dirección o agregar una nueva?`
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: {
              id: `select_address_${customer.addresses[0].id}:${preOrderId}`,
              title: "✅ Usar esta"
            }
          },
          {
            type: "reply",
            reply: {
              id: `add_new_address_preorder:${preOrderId}`,
              title: "➕ Nueva dirección"
            }
          }
        ]
      }
    };
    
    await WhatsAppService.sendInteractiveMessage(from, message);
    return;
  }
  
  // Multiple addresses - send selection list
  const sections = [
    {
      title: "Mis direcciones",
      rows: customer.addresses.map((address) => ({
        id: `select_address_${address.id}:${preOrderId}`,
        title: address.name || `${address.street} ${address.number}`.substring(0, 24),
        description: formatAddressDescription(address).substring(0, 72)
      }))
    }
  ];
  
  // Add option for new address
  sections[0].rows.push({
    id: `add_new_address_preorder:${preOrderId}`,
    title: "➕ Nueva dirección",
    description: "Registrar una nueva dirección de entrega"
  });
  
  await WhatsAppService.sendInteractiveMessage(from, {
    type: "list",
    header: {
      type: "text",
      text: "📍 Cambiar Dirección"
    },
    body: {
      text: "Selecciona la nueva dirección de entrega para tu pedido:"
    },
    footer: {
      text: "Elige una opción"
    },
    action: {
      button: "Ver direcciones",
      sections
    }
  });
}


/**
 * Handles preorder actions (confirm/discard) using the new token-based system
 */
async function handlePreOrderAction(from: string, buttonId: string): Promise<void> {
  // Extract token from button ID
  // Format: preorder_confirm:token or preorder_discard:token
  const parts = buttonId.split(':');
  const token = parts[1];
  
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
