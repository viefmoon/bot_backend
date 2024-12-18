import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import {
  Order,
  OrderItem,
  Product,
  ProductVariant,
  SelectedPizzaIngredient,
  PizzaIngredient,
  SelectedModifier,
  Modifier,
  OrderDeliveryInfo,
  RestaurantConfig,
} from "../models";
import {
  getNextDailyOrderNumber,
  getMexicoDayRange,
  getCurrentMexicoTime,
} from "../utils/timeUtils";
import { CreateOrderDto } from "../dto/create-order.dto";
import { PizzaHalf, IngredientAction } from "../models/selectedPizzaIngredient";
import { sendWhatsAppMessage } from "../utils/whatsAppUtils";
import { Op } from "sequelize";
import logger from "../utils/logger";

export type OrderStatus =
  | "created"
  | "accepted"
  | "in_preparation"
  | "prepared"
  | "in_delivery"
  | "finished"
  | "canceled";

@Injectable()
export class OrderService {
  async getOrders(date?: string, status?: OrderStatus) {
    let whereClause: any = {};

    if (date) {
      const { startDate, endDate } = getMexicoDayRange(date);

      whereClause.createdAt = {
        [Op.between]: [startDate, endDate],
      };
    }

    if (status) {
      whereClause.status = status;
    }

    return Order.findAll({
      where: whereClause,
      order: [
        ["createdAt", "DESC"],
        ["dailyOrderNumber", "DESC"],
      ],
      include: [
        {
          model: OrderItem,
          as: "orderItems",
          attributes: ["quantity", "price", "comments"],
          include: [
            { model: Product, attributes: ["name", "price"] },
            {
              model: ProductVariant,
              as: "productVariant",
              attributes: ["name", "price"],
            },
            {
              model: SelectedPizzaIngredient,
              as: "selectedPizzaIngredients",
              attributes: ["half", "action"],
              include: [{ model: PizzaIngredient, attributes: ["name"] }],
            },
            {
              model: SelectedModifier,
              as: "selectedModifiers",
              attributes: ["id"],
              include: [
                {
                  model: Modifier,
                  as: "modifier",
                  attributes: ["name", "price"],
                },
              ],
            },
          ],
        },
        {
          model: OrderDeliveryInfo,
          as: "orderDeliveryInfo",
        },
      ],
      attributes: [
        "id",
        "dailyOrderNumber",
        "orderType",
        "status",
        "paymentStatus",
        "totalCost",
        "customerId",
        "estimatedTime",
        "scheduledDeliveryTime",
        "syncedWithLocal",
        "localId",
        "createdAt",
        "updatedAt",
        "finishedAt",
      ],
    });
  }

  async getOrdersByCustomer(customerId: string) {
    return this.getOrders().then((orders) =>
      orders.filter((order) => order.customerId === customerId)
    );
  }

  async createOrder(createOrderDto: CreateOrderDto) {
    const {
      orderType,
      orderItems,
      orderDeliveryInfo,
      customerId,
      scheduledDeliveryTime,
    } = createOrderDto;

    const config = await RestaurantConfig.findOne();
    if (!config || !config.acceptingOrders) {
      logger.warn(
        "Intento de crear orden cuando el restaurante no está aceptando pedidos"
      );
      throw new BadRequestException(
        "Lo sentimos, el restaurante no está aceptando pedidos en este momento, puedes intentar mas tarde o llamar al restaurante."
      );
    }

    const mexicoTime = new Date().toLocaleString("en-US", {
      timeZone: "America/Mexico_City",
    });
    const dailyOrderNumber = await getNextDailyOrderNumber();

    let estimatedTime: number;
    if (scheduledDeliveryTime) {
      const now = new Date(mexicoTime);
      const scheduledTimeMexico = new Date(
        scheduledDeliveryTime
      ).toLocaleString("en-US", { timeZone: "America/Mexico_City" });
      const scheduledTime = new Date(scheduledTimeMexico);
      const diffInMinutes = Math.round(
        (scheduledTime.getTime() - now.getTime()) / (1000 * 60)
      );
      estimatedTime = Math.max(diffInMinutes, 0);
    } else {
      estimatedTime =
        orderType === "pickup"
          ? config.estimatedPickupTime
          : config.estimatedDeliveryTime;
    }

    const newOrder = await Order.create({
      dailyOrderNumber,
      orderType: orderType as "delivery" | "pickup",
      status: "created",
      totalCost: 0,
      customerId,
      estimatedTime,
      scheduledDeliveryTime: scheduledDeliveryTime
        ? new Date(scheduledDeliveryTime)
        : null,
    });

    if (orderDeliveryInfo) {
      const deliveryInfo = {
        streetAddress: orderDeliveryInfo.streetAddress,
        neighborhood: orderDeliveryInfo.neighborhood,
        postalCode: orderDeliveryInfo.postalCode,
        city: orderDeliveryInfo.city,
        state: orderDeliveryInfo.state,
        country: orderDeliveryInfo.country,
        latitude: orderDeliveryInfo.latitude,
        longitude: orderDeliveryInfo.longitude,
        pickupName: orderDeliveryInfo.pickupName,
        geocodedAddress: orderDeliveryInfo.geocodedAddress,
        additionalDetails: orderDeliveryInfo.additionalDetails,
        orderId: newOrder.id,
      };

      await OrderDeliveryInfo.create(deliveryInfo);
    }

    const createdItems = await Promise.all(
      orderItems.map(async (item) => {
        const product = await Product.findByPk(item.productId);
        if (!product) {
          throw new BadRequestException(
            `Producto no encontrado: ${item.productId}`
          );
        }
        let itemPrice = product.price || 0;

        if (item.productVariantId) {
          const productVariant = await ProductVariant.findByPk(
            item.productVariantId
          );
          if (!productVariant) {
            throw new BadRequestException(
              `Variante de producto no encontrada: ${item.productVariantId}`
            );
          }
          itemPrice = productVariant.price || 0;
        }

        if (
          item.selectedPizzaIngredients &&
          item.selectedPizzaIngredients.length > 0
        ) {
          let totalIngredientValue = 0;
          let halfIngredientValue = { left: 0, right: 0 };

          for (const ingredient of item.selectedPizzaIngredients) {
            const pizzaIngredient = await PizzaIngredient.findByPk(
              ingredient.pizzaIngredientId
            );
            if (!pizzaIngredient) {
              throw new BadRequestException(
                `Ingrediente de pizza no encontrado en el menu: ${ingredient.pizzaIngredientId}`
              );
            }
            const ingredientValue =
              ingredient.action === IngredientAction.add
                ? pizzaIngredient.ingredientValue
                : -pizzaIngredient.ingredientValue;

            if (ingredient.half === PizzaHalf.full) {
              totalIngredientValue += ingredientValue;
            } else {
              halfIngredientValue[ingredient.half] += ingredientValue;
            }
          }

          if (totalIngredientValue > 4) {
            itemPrice += (totalIngredientValue - 4) * 10;
          }

          for (const half in halfIngredientValue) {
            if (halfIngredientValue[half] > 4) {
              itemPrice += (halfIngredientValue[half] - 4) * 5;
            }
          }
        }

        if (item.selectedModifiers) {
          const modifierPrices = await Promise.all(
            item.selectedModifiers.map(async (modifier) => {
              const mod = await Modifier.findByPk(modifier.modifierId);
              return mod.price;
            })
          );
          itemPrice += modifierPrices.reduce((sum, price) => sum + price, 0);
        }

        const orderItem = await OrderItem.create({
          quantity: item.quantity,
          price: itemPrice,
          comments: item.comments,
          orderId: newOrder.id,
          productId: item.productId,
          productVariantId: item.productVariantId,
        });

        if (item.selectedModifiers) {
          await Promise.all(
            item.selectedModifiers.map((modifier) =>
              SelectedModifier.create({
                orderItemId: orderItem.id,
                modifierId: modifier.modifierId,
              })
            )
          );
        }

        if (item.selectedPizzaIngredients) {
          await Promise.all(
            item.selectedPizzaIngredients.map((ingredient) =>
              SelectedPizzaIngredient.create({
                orderItemId: orderItem.id,
                pizzaIngredientId: ingredient.pizzaIngredientId,
                half: ingredient.half as PizzaHalf,
                action: ingredient.action as IngredientAction,
              })
            )
          );
        }

        return orderItem;
      })
    );

    const totalCost = createdItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    await newOrder.update({ totalCost });

    return {
      orden: {
        id: newOrder.id,
        dailyOrderNumber: newOrder.dailyOrderNumber,
        telefono: newOrder.customerId.startsWith("521")
          ? newOrder.customerId.slice(3)
          : newOrder.customerId,
        tipo: newOrder.orderType,
        estado: newOrder.status,
        informacion_entrega:
          orderType === "delivery"
            ? `${orderDeliveryInfo.streetAddress}${
                orderDeliveryInfo.additionalDetails
                  ? `, ${orderDeliveryInfo.additionalDetails}`
                  : ""
              }`
            : orderDeliveryInfo.pickupName,
        precio_total: newOrder.totalCost,
        fecha_creacion: newOrder.createdAt.toLocaleString("es-MX", {
          timeZone: "America/Mexico_City",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
        productos: await Promise.all(
          createdItems.map(async (item) => {
            const product = await Product.findByPk(item.productId);
            const productVariant = item.productVariantId
              ? await ProductVariant.findByPk(item.productVariantId)
              : null;
            const selectedModifiers = await SelectedModifier.findAll({
              where: { orderItemId: item.id },
              include: [{ model: Modifier, as: "modifier" }],
            });
            const selectedPizzaIngredients =
              await SelectedPizzaIngredient.findAll({
                where: { orderItemId: item.id },
                include: [{ model: PizzaIngredient }],
              });

            return {
              cantidad: item.quantity,
              nombre: productVariant ? productVariant.name : product.name,
              modificadores: selectedModifiers.map((sm) => ({
                nombre: sm.modifier.name, // Cambiamos 'sm.Modifier.name' a 'sm.modifier.name'
                precio: sm.modifier.price, // Cambiamos 'sm.Modifier.price' a 'sm.modifier.price'
              })),
              ingredientes_pizza: selectedPizzaIngredients.map((spi) => ({
                nombre:
                  spi.action === IngredientAction.remove
                    ? `Sin ${spi.PizzaIngredient.name}`
                    : spi.action === IngredientAction.add
                    ? `${spi.PizzaIngredient.name}`
                    : spi.PizzaIngredient.name,
                mitad: spi.half,
              })),
              comments: item.comments,
              precio: item.price,
            };
          })
        ),
        tiempoEstimado: newOrder.estimatedTime,
        ...(newOrder.scheduledDeliveryTime && {
          horario_entrega_programado: new Date(
            newOrder.scheduledDeliveryTime
          ).toLocaleString("es-MX", {
            timeZone: "America/Mexico_City",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          }),
        }),
      },
    };
  }

  async updateOrderStatus(orderId: number, newStatus: OrderStatus) {
    logger.info(`Actualizando estado de la orden ${orderId} a ${newStatus}`);
    const order = await Order.findByPk(orderId);

    if (!order) {
      logger.error(`No se encontró la orden con ID ${orderId}`);
      throw new NotFoundException(`No se encontró la orden con ID ${orderId}`);
    }

    if (
      !Object.values(Order.getAttributes().status.values).includes(newStatus)
    ) {
      throw new BadRequestException(`Estado de orden no válido: ${newStatus}`);
    }

    order.status = newStatus;
    await order.save();

    // Enviar mensaje de WhatsApp al cliente
    const mensaje = this.getOrderStatusMessage(
      newStatus,
      order.dailyOrderNumber
    );
    await sendWhatsAppMessage(order.customerId, mensaje);

    return {
      mensaje: `Estado de la orden ${orderId} actualizado a ${newStatus}`,
      orden: {
        id: order.id,
        estado: order.status,
        fechaActualizacion: order.updatedAt.toLocaleString("es-MX", {
          timeZone: "America/Mexico_City",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
      },
    };
  }

  private getOrderStatusMessage(
    status: OrderStatus,
    dailyOrderNumber: number
  ): string {
    switch (status) {
      case "accepted":
        return `¡Buenas noticias! 🎉 Tu orden #${dailyOrderNumber} ha sido aceptada y pronto comenzaremos a prepararla. 👨‍🍳`;
      case "in_preparation":
        return `Tu orden #${dailyOrderNumber} ya está siendo preparada. 🍕👨‍🍳`;
      case "prepared":
        return `¡Tu orden #${dailyOrderNumber} está lista! 🍽️ Pronto saldrá para entrega o estará lista para recoger. 🚀`;
      case "in_delivery":
        return `¡Tu orden #${dailyOrderNumber} está en camino! 🚚💨 Estará contigo en breve.`;
      case "finished":
        return `¡Tu orden #${dailyOrderNumber} esta en camino a ser entregada! 🎊 Muchas gracias por tu preferencia. ¡Buen provecho! 😋`;
      case "canceled":
        return `Lo sentimos, tu orden #${dailyOrderNumber} ha sido cancelada. ❌ Si tienes alguna pregunta, por favor contáctanos. 📞`;
      default:
        return `El estado de tu orden #${dailyOrderNumber} ha sido actualizado a: ${status} 📝`;
    }
  }

  async getUnsyncedOrders() {
    const { startDate, endDate } = getMexicoDayRange(
      getCurrentMexicoTime().format("YYYY-MM-DD")
    );

    const unsyncedOrders = await Order.findAll({
      where: {
        syncedWithLocal: false,
        status: "accepted",
        createdAt: {
          [Op.between]: [startDate, endDate],
        },
      },
      order: [["createdAt", "ASC"]],
      include: [
        {
          model: OrderItem,
          as: "orderItems",
          include: [
            { model: Product },
            { model: ProductVariant, as: "productVariant" },
            {
              model: SelectedPizzaIngredient,
              as: "selectedPizzaIngredients",
              include: [{ model: PizzaIngredient }],
            },
            {
              model: SelectedModifier,
              as: "selectedModifiers",
              include: [{ model: Modifier, as: "modifier" }],
            },
          ],
        },
        {
          model: OrderDeliveryInfo,
          as: "orderDeliveryInfo",
        },
      ],
    });

    return unsyncedOrders;
  }

  async updateOrderSyncStatus(orderId: number, localId: number) {
    const order = await Order.findByPk(orderId);
    if (!order) {
      throw new NotFoundException(`No se encontró la orden con ID ${orderId}`);
    }

    order.syncedWithLocal = true;
    order.localId = localId;
    await order.save();

    return {
      mensaje: `Orden ${orderId} sincronizada con éxito. ID local: ${localId}`,
      orden: {
        id: order.id,
        localId: order.localId,
        syncedWithLocal: order.syncedWithLocal,
        fechaActualizacion: order.updatedAt.toLocaleString("es-MX", {
          timeZone: "America/Mexico_City",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
      },
    };
  }

  async completeOrdersByLocalId(localIds: number[]) {
    logger.info(`Completando ${localIds.length} órdenes`);
    logger.info(localIds);
    const { startDate, endDate } = getMexicoDayRange(
      getCurrentMexicoTime().format("YYYY-MM-DD")
    );

    for (const localId of localIds) {
      const order = await Order.findOne({
        where: {
          localId: localId,
          createdAt: {
            [Op.between]: [startDate, endDate],
          },
        },
      });

      if (order) {
        await order.update({
          status: "finished",
          finishedAt: new Date(),
        });

        if (order.orderType === "delivery") {
          const mensaje = this.getOrderStatusMessage(
            "finished",
            order.dailyOrderNumber
          );
          try {
            await sendWhatsAppMessage(order.customerId, mensaje);
          } catch (error) {
            logger.error(
              `Error enviando mensaje WhatsApp para orden ${order.id}:`,
              error
            );
          }
        }
      } else {
        logger.warn(
          `No se encontró orden con localId ${localId} para la fecha actual`
        );
      }
    }

    return {
      mensaje: `${localIds.length} órdenes marcadas como completadas`,
      completadas: localIds,
    };
  }

  async getUnfinishedOrders(date?: string) {
    // Si no se proporciona fecha, usar la fecha actual en México
    const targetDate = date || getCurrentMexicoTime().format("YYYY-MM-DD");

    const { startDate, endDate } = getMexicoDayRange(targetDate);

    const unfinishedOrders = await Order.findAll({
      where: {
        status: {
          [Op.ne]: "finished",
        },
        createdAt: {
          [Op.between]: [startDate, endDate],
        },
      },
      order: [["createdAt", "ASC"]],
    });

    return unfinishedOrders;
  }
}
