import { Injectable, BadRequestException } from "@nestjs/common";
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
import { verificarHorarioAtencion } from "../utils/timeUtils";
import { getNextDailyOrderNumber } from "../utils/orderUtils";
import { CreateOrderDto } from "../dto/create-order.dto";
import { PizzaHalf, IngredientAction } from "../models/selectedPizzaIngredient";
import { OrderDeliveryInfoCreationAttributes } from "../models/orderDeliveryInfo";

@Injectable()
export class OrderService {
  async getOrders(date?: string) {
    const whereClause = date ? { orderDate: date } : {};

    return Order.findAll({
      where: whereClause,
      order: [
        ["orderDate", "DESC"],
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
        // {
        //   model: OrderDeliveryInfo,
        //   as: "orderDeliveryInfo",
        //   attributes: ["streetAddress", "pickupName"],
        // },
      ],
      attributes: [
        "id",
        "dailyOrderNumber",
        "orderType",
        "status",
        "paymentStatus",
        "totalCost",
        "clientId",
        "orderDate",
        "estimatedTime",
        "scheduledDeliveryTime",
        "createdAt",
        "updatedAt",
      ],
    });
  }

  async getOrdersByClient(clientId: string) {
    return this.getOrders().then((orders) =>
      orders.filter((order) => order.clientId === clientId),
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
        "El restaurante no está aceptando pedidos en este momento",
      );
    }

    const estaAbierto = await verificarHorarioAtencion();
    if (!estaAbierto) {
      throw new BadRequestException(
        "El restaurante está cerrado en este momento",
      );
    }

    const mexicoTime = new Date().toLocaleString("en-US", {
      timeZone: "America/Mexico_City",
    });
    const today = new Date(mexicoTime).toISOString().split("T")[0];
    const dailyOrderNumber = await getNextDailyOrderNumber();

    let estimatedTime;
    if (scheduledDeliveryTime) {
      const now = new Date(mexicoTime);
      const scheduledTimeMexico = new Date(
        scheduledDeliveryTime,
      ).toLocaleString("en-US", {
        timeZone: "America/Mexico_City",
      });
      const scheduledTime = new Date(scheduledTimeMexico);
      const diffInMinutes = Math.round(
        (scheduledTime.getTime() - now.getTime()) / (1000 * 60),
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
      orderDate: new Date(today),
      estimatedTime,
      scheduledDeliveryTime: scheduledDeliveryTime
        ? new Date(scheduledDeliveryTime)
        : null,
    });

    if (orderDeliveryInfo) {
      await OrderDeliveryInfo.create({
        ...orderDeliveryInfo,
        orderId: newOrder.id,
      } as OrderDeliveryInfoCreationAttributes);
    }

    const createdItems = await Promise.all(
      orderItems.map(async (item) => {
        const product = await Product.findByPk(item.productId);
        if (!product) {
          throw new Error(`Producto no encontrado: ${item.productId}`);
        }
        let itemPrice = product.price || 0;

        if (item.productVariantId) {
          const productVariant = await ProductVariant.findByPk(
            item.productVariantId,
          );
          if (!productVariant) {
            throw new Error(
              `Variante de producto no encontrada: ${item.productVariantId}`,
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
              ingredient.pizzaIngredientId,
            );
            if (!pizzaIngredient) {
              throw new Error(
                `Ingrediente de pizza no encontrado en el menu: ${ingredient.pizzaIngredientId}`,
              );
            }
            const ingredientValue =
              ingredient.action === "add"
                ? pizzaIngredient.ingredientValue
                : -pizzaIngredient.ingredientValue;

            if (ingredient.half === "full") {
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
            }),
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
              }),
            ),
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
              }),
            ),
          );
        }

        return orderItem;
      }),
    );

    const totalCost = createdItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    await newOrder.update({ totalCost });

    return newOrder;
  }
}
