import { prisma } from '../server';
import { sendWhatsAppMessage } from '../services/whatsapp';
import { createCheckoutSession } from '../services/stripe';
import { generateAndSendOTP } from '../services/otp';
import { getFullMenu } from '../services/menu';
import { 
  WAIT_TIMES_MESSAGE, 
  RESTAURANT_INFO_MESSAGE, 
  CHATBOT_HELP_MESSAGE 
} from '../config/predefinedMessages';
import logger from '../utils/logger';

export async function handleInteractiveMessage(
  from: string,
  interactive: any
): Promise<void> {
  const buttonReply = interactive.button_reply;
  const listReply = interactive.list_reply;
  const messageId = interactive.response?.message_id;

  if (!buttonReply && !listReply) return;

  const actionId = buttonReply?.id || listReply?.id;
  logger.info(`Interactive action: ${actionId} by ${from}`);

  try {
    // Handle button replies
    if (buttonReply) {
      switch (actionId) {
        case 'confirm_order':
          await handleConfirmOrder(from, messageId);
          break;
        
        case 'modify_delivery':
          await handleModifyDelivery(from);
          break;
        
        case 'discard_order':
          await handleDiscardOrder(from);
          break;
        
        case 'request_otp':
          await handleRequestOTP(from);
          break;
        
        case 'pay_with_card':
          await handlePayWithCard(from, messageId);
          break;
        
        case 'pay_on_delivery':
          await handlePayOnDelivery(from, messageId);
          break;
        
        case 'cancel_order':
          await handleCancelOrder(from, messageId);
          break;
        
        default:
          await sendWhatsAppMessage(from, "Opción no reconocida. Por favor intenta de nuevo.");
      }
    }
    
    // Handle list replies (from welcome message)
    if (listReply) {
      switch (actionId) {
        case 'view_menu':
          await handleViewMenu(from);
          break;
        
        case 'make_order':
          await handleMakeOrder(from);
          break;
        
        case 'wait_times':
          await handleWaitTimes(from);
          break;
        
        case 'restaurant_info':
          await handleRestaurantInfo(from);
          break;
        
        case 'chatbot_help':
          await handleChatbotHelp(from);
          break;
        
        default:
          await sendWhatsAppMessage(from, "Opción no reconocida. Por favor intenta de nuevo.");
      }
    }
  } catch (error) {
    logger.error('Error handling interactive message:', error);
    await sendWhatsAppMessage(
      from,
      "Ocurrió un error procesando tu solicitud. Por favor intenta de nuevo."
    );
  }
}

async function handleConfirmOrder(customerId: string, messageId: string) {
  // Find preOrder by messageId
  const preOrder = await prisma.preOrder.findFirst({
    where: { 
      customerId,
      messageId 
    }
  });

  if (!preOrder) {
    await sendWhatsAppMessage(customerId, "No se encontró la orden para confirmar.");
    return;
  }

  // Generate OTP
  const otpSent = await generateAndSendOTP(customerId);
  if (!otpSent) {
    await sendWhatsAppMessage(
      customerId,
      "Error al enviar el código de verificación. Por favor intenta de nuevo."
    );
    return;
  }

  await sendWhatsAppMessage(
    customerId,
    "📱 Te hemos enviado un código de verificación por SMS. Por favor ingrésalo para confirmar tu orden."
  );
}

async function handleModifyDelivery(customerId: string) {
  await sendWhatsAppMessage(
    customerId,
    "Para modificar tu dirección de entrega, por favor envíame tu nueva dirección completa."
  );
}

async function handleDiscardOrder(customerId: string) {
  // Delete all preOrders for this customer
  await prisma.preOrder.deleteMany({
    where: { customerId }
  });

  await sendWhatsAppMessage(
    customerId,
    "❌ Tu orden ha sido descartada. ¿Hay algo más en lo que pueda ayudarte?"
  );
}

async function handleRequestOTP(customerId: string) {
  const otpSent = await generateAndSendOTP(customerId);
  
  if (otpSent) {
    await sendWhatsAppMessage(
      customerId,
      "📱 Te hemos enviado un nuevo código de verificación por SMS."
    );
  } else {
    await sendWhatsAppMessage(
      customerId,
      "Error al enviar el código. Por favor espera unos minutos antes de intentar de nuevo."
    );
  }
}

async function handlePayWithCard(customerId: string, messageId: string) {
  const order = await prisma.order.findFirst({
    where: { 
      customerId,
      messageId,
      status: 'created'
    }
  });

  if (!order) {
    await sendWhatsAppMessage(customerId, "No se encontró la orden para pagar.");
    return;
  }

  try {
    const session = await createCheckoutSession(
      order.id,
      order.totalCost,
      customerId
    );

    await sendWhatsAppMessage(
      customerId,
      `💳 Haz clic en el siguiente enlace para completar tu pago:\n\n${session.url}\n\nEste enlace expirará en 30 minutos.`
    );
  } catch (error) {
    logger.error('Error creating checkout session:', error);
    await sendWhatsAppMessage(
      customerId,
      "Error al generar el enlace de pago. Por favor intenta de nuevo."
    );
  }
}

async function handlePayOnDelivery(customerId: string, messageId: string) {
  const order = await prisma.order.findFirst({
    where: { 
      customerId,
      messageId,
      status: 'created'
    }
  });

  if (!order) {
    await sendWhatsAppMessage(customerId, "No se encontró la orden para confirmar.");
    return;
  }

  // Update order status to accepted
  await prisma.order.update({
    where: { id: order.id },
    data: { 
      status: 'accepted',
      paymentStatus: 'pending'
    }
  });

  const estimatedTime = order.orderType === 'pickup' 
    ? process.env.ESTIMATED_PICKUP_TIME || '20'
    : process.env.ESTIMATED_DELIVERY_TIME || '40';

  await sendWhatsAppMessage(
    customerId,
    `✅ ¡Tu orden #${order.dailyOrderNumber} ha sido confirmada!\n\n` +
    `📍 Tipo: ${order.orderType === 'pickup' ? 'Recolección' : 'Entrega a domicilio'}\n` +
    `⏱️ Tiempo estimado: ${estimatedTime} minutos\n` +
    `💵 Pago: En efectivo al ${order.orderType === 'pickup' ? 'recoger' : 'recibir'}\n\n` +
    `Te notificaremos cuando tu orden esté lista. ¡Gracias por tu preferencia!`
  );
}

async function handleCancelOrder(customerId: string, messageId: string) {
  const order = await prisma.order.findFirst({
    where: { 
      customerId,
      messageId,
      status: { in: ['created', 'accepted'] }
    }
  });

  if (!order) {
    await sendWhatsAppMessage(customerId, "No se encontró la orden para cancelar.");
    return;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'canceled' }
  });

  await sendWhatsAppMessage(
    customerId,
    `❌ Tu orden #${order.dailyOrderNumber} ha sido cancelada.\n\n¿Hay algo más en lo que pueda ayudarte?`
  );
}

// List reply handlers
async function handleViewMenu(customerId: string) {
  try {
    const menuData = await getFullMenu();
    let menuText = "🍕 *MENÚ LA LEÑA* 🍕\n\n";
    
    for (const category of menuData.categories) {
      menuText += `━━━━━━━━━━━━━━━━\n*${category.name.toUpperCase()}*\n━━━━━━━━━━━━━━━━\n\n`;
      
      for (const subcategory of category.subcategories) {
        if (subcategory.products.length > 0) {
          menuText += `📌 *${subcategory.name}*\n\n`;
          
          for (const product of subcategory.products) {
            // Nombre del producto
            menuText += `▪️ *${product.name}*\n`;
            
            // Ingredientes si los tiene
            if (product.ingredients) {
              menuText += `   _${product.ingredients}_\n`;
            }
            
            // Si tiene variantes, mostrarlas
            if (product.variants && product.variants.length > 0) {
              for (const variant of product.variants) {
                menuText += `   • ${variant.name}: $${variant.price}\n`;
              }
            } else if (product.price) {
              // Si no tiene variantes pero sí precio
              menuText += `   Precio: $${product.price}\n`;
            }
            
            // Modificadores disponibles
            if (product.modifierTypes && product.modifierTypes.length > 0) {
              for (const modType of product.modifierTypes) {
                if (modType.modifiers && modType.modifiers.length > 0) {
                  menuText += `   🔸 ${modType.name}:\n`;
                  for (const mod of modType.modifiers) {
                    menuText += `      - ${mod.name}: +$${mod.price}\n`;
                  }
                }
              }
            }
            
            // Ingredientes de pizza si aplica
            if (product.pizzaIngredients && product.pizzaIngredients.length > 0) {
              menuText += `   🍕 Ingredientes disponibles:\n`;
              const ingredients = product.pizzaIngredients
                .map(ing => ing.name)
                .join(', ');
              menuText += `      ${ingredients}\n`;
            }
            
            menuText += '\n';
          }
        }
      }
    }
    
    menuText += `\n💬 Para ordenar, simplemente escribe lo que deseas.\n`;
    menuText += `📞 ¿Preguntas? ¡Estamos para ayudarte!`;
    
    // Dividir el mensaje si es muy largo
    const maxLength = 4096;
    if (menuText.length > maxLength) {
      const parts = [];
      let currentPart = '';
      const lines = menuText.split('\n');
      
      for (const line of lines) {
        if ((currentPart + line + '\n').length > maxLength) {
          parts.push(currentPart);
          currentPart = line + '\n';
        } else {
          currentPart += line + '\n';
        }
      }
      
      if (currentPart) {
        parts.push(currentPart);
      }
      
      // Enviar cada parte
      for (let i = 0; i < parts.length; i++) {
        await sendWhatsAppMessage(customerId, parts[i]);
        // Pequeña pausa entre mensajes para evitar problemas
        if (i < parts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } else {
      await sendWhatsAppMessage(customerId, menuText);
    }
    
  } catch (error) {
    logger.error('Error al enviar el menú:', error);
    await sendWhatsAppMessage(
      customerId,
      "❌ Hubo un error al obtener el menú. Por favor intenta de nuevo más tarde."
    );
  }
}

async function handleMakeOrder(customerId: string) {
  await sendWhatsAppMessage(
    customerId,
    "¡Perfecto! 🍕 Para hacer tu pedido, simplemente escríbeme lo que deseas ordenar. Por ejemplo:\n\n" +
    "• '2 pizzas hawaianas grandes'\n" +
    "• 'Una pizza pepperoni mediana y una coca cola'\n" +
    "• 'Quiero ordenar 3 hamburguesas con papas'\n\n" +
    "¿Qué te gustaría ordenar hoy?"
  );
}

async function handleWaitTimes(customerId: string) {
  try {
    // Obtener tiempos de la configuración del restaurante
    const restaurantConfig = await prisma.restaurantConfig.findFirst();
    const pickupTime = restaurantConfig?.estimatedPickupTime || 20;
    const deliveryTime = restaurantConfig?.estimatedDeliveryTime || 40;
    
    await sendWhatsAppMessage(
      customerId,
      WAIT_TIMES_MESSAGE(pickupTime, deliveryTime)
    );
  } catch (error) {
    logger.error('Error al obtener tiempos de espera:', error);
    await sendWhatsAppMessage(
      customerId,
      "❌ Hubo un error al obtener los tiempos de espera. Por favor intenta de nuevo."
    );
  }
}

async function handleRestaurantInfo(customerId: string) {
  await sendWhatsAppMessage(customerId, RESTAURANT_INFO_MESSAGE);
}

async function handleChatbotHelp(customerId: string) {
  await sendWhatsAppMessage(customerId, CHATBOT_HELP_MESSAGE);
}