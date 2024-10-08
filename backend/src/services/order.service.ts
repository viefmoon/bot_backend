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
import { getNextDailyOrderNumber } from "../utils/orderUtils";
import { CreateOrderDto } from "../dto/create-order.dto";
import { PizzaHalf, IngredientAction } from "../models/selectedPizzaIngredient";
import { sendWhatsAppMessage } from "../utils/whatsAppUtils";
import { Op } from "sequelize";
import { DateTime } from "luxon";

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
      // Parsear la fecha asumiendo que ya está en hora de México
      const mexicoDate = DateTime.fromISO(date, {
        zone: "America/Mexico_City",
      });

      // Definir el inicio y fin del día en UTC
      const startDate = mexicoDate.startOf("day").toUTC();
      const endDate = mexicoDate.endOf("day").toUTC();

      whereClause.createdAt = {
        [Op.between]: [startDate.toJSDate(), endDate.toJSDate()],
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
            { model: ProductVariant, attributes: ["name", "price"] },
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
              include: [{ model: Modifier, attributes: ["name", "price"] }],
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
        "clientId",
        "estimatedTime",
        "scheduledDeliveryTime",
        "createdAt",
        "updatedAt",
      ],
    });
  }

  async getOrdersByClient(clientId: string) {
    return this.getOrders().then((orders) =>
      orders.filter((order) => order.clientId === clientId)
    );
  }

  async createOrder(createOrderDto: CreateOrderDto) {
    const {
      orderType,
      orderItems,
      orderDeliveryInfo,
      clientId,
      scheduledDeliveryTime,
    } = createOrderDto;

    const config = await RestaurantConfig.findOne();
    if (!config || !config.acceptingOrders) {
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
      clientId,
      estimatedTime,
      scheduledDeliveryTime: scheduledDeliveryTime
        ? new Date(scheduledDeliveryTime)
        : null,
    });

    if (orderDeliveryInfo) {
      const { preOrderId, id, ...deliveryInfoWithoutPreOrder } =
        orderDeliveryInfo;

      await OrderDeliveryInfo.create({
        ...deliveryInfoWithoutPreOrder,
        orderId: newOrder.id,
      });
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
        id: newOrder.dailyOrderNumber,
        telefono: newOrder.clientId.startsWith("521")
          ? newOrder.clientId.slice(3)
          : newOrder.clientId,
        tipo: newOrder.orderType,
        estado: newOrder.status,
        informacion_entrega:
          orderType === "delivery"
            ? orderDeliveryInfo.streetAddress
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
              include: [{ model: Modifier }],
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
                nombre: sm.Modifier.name,
                precio: sm.Modifier.price,
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
    const order = await Order.findByPk(orderId);

    if (!order) {
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
    await sendWhatsAppMessage(order.clientId, mensaje);

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
        return `¡Buenas noticias! Tu orden #${dailyOrderNumber} ha sido aceptada y pronto comenzaremos a prepararla.`;
      case "in_preparation":
        return `Tu orden #${dailyOrderNumber} ya está siendo preparada.`;
      case "prepared":
        return `¡Tu orden #${dailyOrderNumber} está lista! Pronto saldrá para entrega o estará lista para recoger.`;
      case "in_delivery":
        return `¡Tu orden #${dailyOrderNumber} está en camino! Estará contigo en breve.`;
      case "finished":
        return `¡Tu orden #${dailyOrderNumber} está en camino! Estará contigo en breve, Muchas gracias por tu preferencia.`;
      case "canceled":
        return `Lo sentimos, tu orden #${dailyOrderNumber} ha sido cancelada. Si tienes alguna pregunta, por favor contáctanos.`;
      default:
        return `El estado de tu orden #${dailyOrderNumber} ha sido actualizado a: ${status}`;
    }
  }

  private convertToUTC(date: Date, fromTimeZone: string): Date {
    const localDate = new Date(
      date.toLocaleString("en-US", { timeZone: fromTimeZone })
    );
    const utcDate = new Date(
      localDate.getTime() + localDate.getTimezoneOffset() * 60000
    );
    return utcDate;
  }
}
