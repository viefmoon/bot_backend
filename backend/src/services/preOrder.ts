import { prisma } from '../server';
import { OrderType, Prisma } from '@prisma/client';
import logger from '../utils/logger';
import { getProductById, getProductVariantById, getModifierById, getPizzaIngredientById } from './menu';
import { getRestaurantConfig } from './restaurantConfig';
import { isWithinBusinessHours } from '../utils/timeUtils';

interface OrderItemInput {
  productId: string;
  quantity: number;
  productVariant?: {
    productVariantId: string;
  };
  selectedModifiers?: Array<{
    modifierId: string;
  }>;
  selectedPizzaIngredients?: Array<{
    pizzaIngredientId: string;
    half: 'left' | 'right' | 'full';
    action: 'add' | 'remove';
  }>;
  comments?: string;
}

interface SelectProductsInput {
  orderItems: OrderItemInput[];
  customerId: string;
  orderType: OrderType;
  scheduledDeliveryTime?: Date | string;
}

export class PreOrderService {
  async selectProducts(input: SelectProductsInput) {
    try {
      let totalCost = 0;
      const { orderItems, customerId, orderType, scheduledDeliveryTime } = input;

      // Get restaurant config
      const config = await getRestaurantConfig();
      
      if (!config.acceptingOrders) {
        throw new Error("Lo sentimos, no estamos aceptando pedidos en este momento.");
      }

      // Validate scheduled delivery time if provided
      let fullScheduledDeliveryTime: Date | null = null;
      if (scheduledDeliveryTime) {
        fullScheduledDeliveryTime = new Date(scheduledDeliveryTime);
        
        // Validate business hours
        const validation = await isWithinBusinessHours(fullScheduledDeliveryTime);
        if (!validation.isOpen) {
          throw new Error(validation.message);
        }

        // Validate minimum time
        const now = new Date();
        const minTimeRequired = orderType === 'pickup' 
          ? config.estimatedPickupTime 
          : config.estimatedDeliveryTime;
        
        const timeDifference = (fullScheduledDeliveryTime.getTime() - now.getTime()) / (1000 * 60);
        
        if (timeDifference < minTimeRequired) {
          throw new Error(
            `La hora programada debe ser al menos ${minTimeRequired} minutos después de la hora actual.`
          );
        }
      }

      // Get customer delivery info
      const customerDeliveryInfo = await prisma.customerDeliveryInfo.findUnique({
        where: { customerId }
      });

      if (!customerDeliveryInfo) {
        throw new Error("Información de entrega del cliente no encontrada.");
      }

      // Create order delivery info
      let deliveryInfoData: Prisma.OrderDeliveryInfoCreateInput = {};
      
      if (orderType === 'delivery') {
        deliveryInfoData = {
          streetAddress: customerDeliveryInfo.streetAddress,
          neighborhood: customerDeliveryInfo.neighborhood,
          postalCode: customerDeliveryInfo.postalCode,
          city: customerDeliveryInfo.city,
          state: customerDeliveryInfo.state,
          country: customerDeliveryInfo.country,
          latitude: customerDeliveryInfo.latitude,
          longitude: customerDeliveryInfo.longitude,
          geocodedAddress: customerDeliveryInfo.geocodedAddress,
          additionalDetails: customerDeliveryInfo.additionalDetails,
        };
      } else if (orderType === 'pickup') {
        deliveryInfoData = {
          pickupName: customerDeliveryInfo.pickupName,
        };
      }

      const orderDeliveryInfo = await prisma.orderDeliveryInfo.create({
        data: deliveryInfoData
      });

      // Calculate items and prices
      const calculatedItems = await Promise.all(
        orderItems.map(async (item) => {
          let itemPrice = 0;
          let productName = '';

          // Get product
          const product = await getProductById(item.productId);
          if (!product) {
            throw new Error(`Producto no encontrado en el menú: ${item.productId}`);
          }

          itemPrice = product.price || 0;
          productName = product.name;

          // Get variant if specified
          if (item.productVariant?.productVariantId) {
            const variant = await getProductVariantById(item.productVariant.productVariantId);
            if (variant) {
              itemPrice = variant.price;
              productName = variant.name;
            }
          }

          // Validate pizza ingredients
          if (product.id === 'PZ' && (!item.selectedPizzaIngredients || item.selectedPizzaIngredients.length === 0)) {
            throw new Error(`El producto "${productName}" requiere al menos un ingrediente de pizza`);
          }

          // Calculate pizza ingredients price
          if (item.selectedPizzaIngredients && item.selectedPizzaIngredients.length > 0) {
            let halfIngredientValue = { left: 0, right: 0 };

            for (const ingredient of item.selectedPizzaIngredients) {
              const pizzaIngredient = await getPizzaIngredientById(ingredient.pizzaIngredientId);
              if (!pizzaIngredient) {
                throw new Error(`Ingrediente de pizza no encontrado: ${ingredient.pizzaIngredientId}`);
              }

              const ingredientValue = ingredient.action === 'add' 
                ? pizzaIngredient.ingredientValue 
                : -pizzaIngredient.ingredientValue;

              if (ingredient.half === 'full') {
                halfIngredientValue.left += ingredientValue;
                halfIngredientValue.right += ingredientValue;
              } else {
                halfIngredientValue[ingredient.half] += ingredientValue;
              }
            }

            // Calculate additional price for extra ingredients
            for (const half in halfIngredientValue) {
              if (halfIngredientValue[half as keyof typeof halfIngredientValue] > 4) {
                itemPrice += (halfIngredientValue[half as keyof typeof halfIngredientValue] - 4) * 5;
              }
            }
          }

          // Calculate modifiers price
          let modifierNames: string[] = [];
          if (item.selectedModifiers && item.selectedModifiers.length > 0) {
            for (const selectedMod of item.selectedModifiers) {
              const modifier = await getModifierById(selectedMod.modifierId);
              if (!modifier) {
                throw new Error(`Modificador no encontrado: ${selectedMod.modifierId}`);
              }
              itemPrice += modifier.price;
              modifierNames.push(modifier.name);
            }
          }

          // Get pizza ingredient names
          let pizzaIngredientNames: { left: string[], right: string[], full: string[] } = { 
            left: [], right: [], full: [] 
          };
          
          if (item.selectedPizzaIngredients && item.selectedPizzaIngredients.length > 0) {
            for (const ingredient of item.selectedPizzaIngredients) {
              const pizzaIngredient = await getPizzaIngredientById(ingredient.pizzaIngredientId);
              if (!pizzaIngredient) continue;
              
              const ingredientName = ingredient.action === 'remove'
                ? `Sin ${pizzaIngredient.name}`
                : pizzaIngredient.name;
                
              pizzaIngredientNames[ingredient.half].push(ingredientName);
            }
          }

          const totalItemPrice = itemPrice * item.quantity;
          totalCost += totalItemPrice;

          return {
            ...item,
            precio_total_orderItem: totalItemPrice,
            nombre_producto: productName,
            modificadores: modifierNames,
            ingredientes_pizza: pizzaIngredientNames,
          };
        })
      );

      // Format message
      let messageContent = "Informame si tienes algun cambio o deseas agregar algun producto mas.\n\n";
      let relevantMessageContent = "Resumen del pedido hasta este momento, informame si tienes algun cambio o deseas agregar algun producto mas.\n\n";

      const deliveryInfo = orderType === 'delivery'
        ? orderDeliveryInfo.streetAddress + (orderDeliveryInfo.additionalDetails ? `, ${orderDeliveryInfo.additionalDetails}` : '')
        : orderDeliveryInfo.pickupName;

      messageContent += `${orderType === 'delivery' ? '🚚' : '🏬'} *${orderType === 'delivery' ? 'Domicilio' : 'Nombre recolección'}*: ${deliveryInfo || 'No disponible'}\n`;
      relevantMessageContent += `${orderType === 'delivery' ? 'Domicilio' : 'Nombre recolección'}: ${deliveryInfo || 'No disponible'}\n`;

      if (fullScheduledDeliveryTime) {
        const scheduledTime = fullScheduledDeliveryTime.toLocaleString('es-MX', {
          timeZone: 'America/Mexico_City',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        messageContent += `⏱️ *Hora programada*: ${scheduledTime}\n`;
      } else {
        const estimatedTime = orderType === 'pickup'
          ? `${config.estimatedPickupTime} minutos`
          : `${config.estimatedDeliveryTime} minutos`;
        messageContent += `⏱️ *Tiempo estimado*: ${estimatedTime}\n`;
      }

      // Add items to message
      calculatedItems.forEach((item) => {
        messageContent += `- *${item.quantity}x ${item.nombre_producto}*: $${item.precio_total_orderItem}\n`;
        relevantMessageContent += `- *${item.quantity}x ${item.nombre_producto}*\n`;

        // Add pizza ingredients
        if (item.ingredientes_pizza.full.length > 0 || 
            item.ingredientes_pizza.left.length > 0 || 
            item.ingredientes_pizza.right.length > 0) {
          messageContent += "  🔸 Ingredientes de pizza:\n";
          relevantMessageContent += "  Ingredientes de pizza:\n";

          const leftIngredients = [...item.ingredientes_pizza.left, ...item.ingredientes_pizza.full];
          const rightIngredients = [...item.ingredientes_pizza.right, ...item.ingredientes_pizza.full];

          if (item.ingredientes_pizza.full.length > 0 && 
              item.ingredientes_pizza.left.length === 0 && 
              item.ingredientes_pizza.right.length === 0) {
            messageContent += `    ${leftIngredients.join(', ')}\n`;
            relevantMessageContent += `    ${leftIngredients.join(', ')}\n`;
          } else {
            messageContent += `    (${leftIngredients.join(', ')} / ${rightIngredients.join(', ')})\n`;
            relevantMessageContent += `    (${leftIngredients.join(', ')} / ${rightIngredients.join(', ')})\n`;
          }
        }

        // Add modifiers
        if (item.modificadores.length > 0) {
          messageContent += `  🔸 Modificadores: ${item.modificadores.join(', ')}\n`;
          relevantMessageContent += `  Modificadores: ${item.modificadores.join(', ')}\n`;
        }

        // Add comments
        if (item.comments) {
          messageContent += `  💬 Comentarios: ${item.comments}\n`;
          relevantMessageContent += `  Comentarios: ${item.comments}\n`;
        }
      });

      messageContent += `\n💰 *Total: $${totalCost}*`;

      // Delete existing preorders for customer
      await prisma.preOrder.deleteMany({
        where: { customerId }
      });

      // Create new preorder
      const preOrder = await prisma.preOrder.create({
        data: {
          orderItems: orderItems as any,
          orderType,
          scheduledDeliveryTime: fullScheduledDeliveryTime,
          customerId,
        }
      });

      // Update delivery info with preOrder ID
      await prisma.orderDeliveryInfo.update({
        where: { id: orderDeliveryInfo.id },
        data: { preOrderId: preOrder.id }
      });

      // Return response
      return {
        status: 200,
        json: {
          sendToWhatsApp: false,
          text: relevantMessageContent,
          preOrderId: preOrder.id,
          isRelevant: true,
          interactiveMessage: {
            type: "button",
            header: {
              type: "text",
              text: "Resumen del Pedido",
            },
            body: {
              text: messageContent,
            },
            action: {
              buttons: [
                {
                  type: "reply",
                  reply: {
                    id: "modify_delivery",
                    title: "Modificar Entrega",
                  },
                },
                {
                  type: "reply",
                  reply: {
                    id: "discard_order",
                    title: "Descartar Orden",
                  },
                },
                {
                  type: "reply",
                  reply: {
                    id: "confirm_order",
                    title: "Confirmar Orden",
                  },
                },
              ],
            },
          },
        },
      };
    } catch (error: any) {
      return {
        status: 400,
        json: {
          sendToWhatsApp: true,
          text: error.message,
        },
      };
    }
  }

  async getPreOrderById(preOrderId: number) {
    return await prisma.preOrder.findUnique({
      where: { id: preOrderId }
    });
  }
}