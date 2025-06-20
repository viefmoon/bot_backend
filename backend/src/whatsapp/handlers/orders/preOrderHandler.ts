import { prisma } from "../../../server";
import logger from "../../../common/utils/logger";
import { sendWhatsAppMessage, WhatsAppService } from "../../../services/whatsapp";
import { PreOrderService } from "../../../services/orders/PreOrderService";
import { generateOrderSummary } from "./orderFormatters";
import { ErrorService, BusinessLogicError, ValidationError, ErrorCode } from "../../../common/services/errors";
import { OrderManagementService } from "../../../services/orders/services/OrderManagementService";

// Crear una preorden con los productos seleccionados
export async function createPreOrderAndSendSummary(
  result: any,
  phone: string
): Promise<void> {
  try {
    // Validar que el resultado tenga la estructura esperada
    if (!result.productos || result.productos.length === 0) {
      throw new ValidationError(
        ErrorCode.INVALID_PRODUCT,
        'No products in order',
        { userId: phone, operation: 'createPreOrderAndSendSummary' }
      );
    }

    const preOrderService = new PreOrderService();

    // Construir los datos para la preorden
    const orderData = {
      orderItems: result.productos.map((producto: any) => ({
        productId: producto.productId,
        productVariantId: producto.productVariantId,
        quantity: producto.cantidad,
        comments: producto.comments,
        selectedModifiers: producto.modificadores.map((mod: any) => mod.id),
        selectedPizzaIngredients: producto.ingredientes_pizza?.map((ing: any) => ({
          pizzaIngredientId: ing.id,
          half: ing.mitad,
          action: ing.action || "add",
        })) || [],
      })),
      whatsappPhoneNumber: phone,
      orderType: result.orderType,
      scheduledAt: result.scheduledAt,
    };

    // Crear la preorden usando el servicio
    const preOrderResult = await preOrderService.createPreOrder(
      orderData
    );
    const { preOrderId, items: selectedProducts } = preOrderResult;

    // Obtener información de entrega si es necesario
    let deliveryInfoId = null;
    if (result.orderType === "delivery" && result.deliveryInfo) {
      const existingDeliveryInfo = await prisma.orderDeliveryInfo.findFirst({
        where: {
          street: result.deliveryInfo.street,
          number: result.deliveryInfo.number,
          neighborhood: result.deliveryInfo.neighborhood,
          city: result.deliveryInfo.city,
        },
      });

      if (existingDeliveryInfo) {
        deliveryInfoId = existingDeliveryInfo.id;
      } else {
        const newDeliveryInfo = await prisma.orderDeliveryInfo.create({
          data: {
            street: result.deliveryInfo.street,
            number: result.deliveryInfo.number,
            interiorNumber: result.deliveryInfo.interiorNumber,
            neighborhood: result.deliveryInfo.neighborhood,
            zipCode: result.deliveryInfo.zipCode,
            city: result.deliveryInfo.city,
            state: result.deliveryInfo.state,
            country: result.deliveryInfo.country || "México",
            latitude: result.deliveryInfo.latitude,
            longitude: result.deliveryInfo.longitude,
            references: result.deliveryInfo.references,
            preOrderId: preOrderId,
          },
        });
        deliveryInfoId = newDeliveryInfo.id;
      }
    } else if (result.orderType === "pickup" && result.pickupName) {
      const pickupInfo = await prisma.orderDeliveryInfo.create({
        data: {
          pickupName: result.pickupName,
          preOrderId: preOrderId,
        },
      });
      deliveryInfoId = pickupInfo.id;
    }

    // Actualizar la preorden con la información de entrega si existe
    if (deliveryInfoId) {
      const preOrder = await prisma.preOrder.update({
        where: { id: preOrderId },
        data: {
          deliveryInfo: {
            connect: { id: deliveryInfoId }
          }
        },
      });
    }

    // Generar y enviar el resumen
    const orderSummary = generateOrderSummary(result);
    await sendWhatsAppMessage(phone, orderSummary);

    // Enviar botones de confirmación
    await sendPreOrderConfirmationButtons(
      phone,
      `preorder_${preOrderId}`
    );
  } catch (error) {
    await ErrorService.handleAndSendError(error, phone, {
      userId: phone,
      operation: 'createPreOrderAndSendSummary',
      metadata: { orderType: result.orderType }
    });
  }
}

// Enviar botones de confirmación para la preorden
async function sendPreOrderConfirmationButtons(
  phone: string,
  messageId: string
): Promise<void> {
  const confirmationMessage = {
    type: "button",
    header: {
      type: "text",
      text: "¿Confirmar pedido?",
    },
    body: {
      text: "Por favor revisa tu pedido y confirma si todo está correcto.",
    },
    action: {
      buttons: [
        {
          type: "reply",
          reply: {
            id: "confirm_preorder",
            title: "✅ Confirmar",
          },
        },
        {
          type: "reply",
          reply: {
            id: "discard_preorder",
            title: "❌ Descartar",
          },
        },
      ],
    },
  };

  await WhatsAppService.sendInteractiveMessage(phone, confirmationMessage, messageId);
}

// Descartar una preorden
export async function handlePreOrderDiscard(
  from: string,
  messageId: string
): Promise<void> {
  try {
    logger.info(
      `Attempting to discard pre-order for customer ${from} with messageId ${messageId}`
    );
    
    const orderManagementService = new OrderManagementService();
    const preOrder = await orderManagementService.getPreOrderByMessageId(messageId);

    if (!preOrder) {
      throw new BusinessLogicError(
        ErrorCode.ORDER_NOT_FOUND,
        'PreOrder not found for discard',
        { userId: from, operation: 'handlePreOrderDiscard', metadata: { messageId } }
      );
    }

    await orderManagementService.discardPreOrder(preOrder.id);
    logger.info(`Pre-order ${preOrder.id} discarded successfully`);

    await sendWhatsAppMessage(
      from,
      "❌ Tu pedido ha sido descartado. Si deseas realizar un nuevo pedido, puedes hacerlo cuando gustes. 🍕"
    );
  } catch (error) {
    await ErrorService.handleAndSendError(error, from, {
      userId: from,
      operation: 'handlePreOrderDiscard',
      metadata: { messageId }
    });
  }
}