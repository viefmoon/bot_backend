"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderService = void 0;
const common_1 = require("@nestjs/common");
const models_1 = require("../models");
const timeUtils_1 = require("../utils/timeUtils");
const orderUtils_1 = require("../utils/orderUtils");
let OrderService = class OrderService {
    async getOrders(date) {
        const whereClause = date ? { orderDate: date } : {};
        return models_1.Order.findAll({
            where: whereClause,
            order: [
                ["orderDate", "DESC"],
                ["dailyOrderNumber", "DESC"],
            ],
            include: [
                {
                    model: models_1.OrderItem,
                    as: "orderItems",
                    attributes: ["quantity", "price", "comments"],
                    include: [
                        { model: models_1.Product, attributes: ["name", "price"] },
                        { model: models_1.ProductVariant, attributes: ["name", "price"] },
                        {
                            model: models_1.SelectedPizzaIngredient,
                            as: "selectedPizzaIngredients",
                            attributes: ["half", "action"],
                            include: { model: models_1.PizzaIngredient, attributes: ["name"] },
                        },
                        {
                            model: models_1.SelectedModifier,
                            as: "selectedModifiers",
                            attributes: ["id"],
                            include: {
                                model: models_1.Modifier,
                                attributes: ["name", "price"],
                            },
                        },
                    ],
                },
                {
                    model: models_1.OrderDeliveryInfo,
                    as: "orderDeliveryInfo",
                    attributes: ["streetAddress", "pickupName"],
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
                "orderDate",
                "estimatedTime",
                "scheduledDeliveryTime",
                "createdAt",
                "updatedAt",
            ],
        });
    }
    async getOrdersByClient(clientId) {
        return this.getOrders().then((orders) => orders.filter((order) => order.clientId === clientId));
    }
    async createOrder(createOrderDto) {
        const { orderType, orderItems, orderDeliveryInfo, clientId, scheduledDeliveryTime, } = createOrderDto;
        const config = await models_1.RestaurantConfig.findOne();
        if (!config || !config.acceptingOrders) {
            throw new common_1.BadRequestException("El restaurante no está aceptando pedidos en este momento");
        }
        const estaAbierto = await (0, timeUtils_1.verificarHorarioAtencion)();
        if (!estaAbierto) {
            throw new common_1.BadRequestException("El restaurante está cerrado en este momento");
        }
        const mexicoTime = new Date().toLocaleString("en-US", {
            timeZone: "America/Mexico_City",
        });
        const today = new Date(mexicoTime).toISOString().split("T")[0];
        const dailyOrderNumber = await (0, orderUtils_1.getNextDailyOrderNumber)();
        let estimatedTime;
        if (scheduledDeliveryTime) {
            const now = new Date(mexicoTime);
            const scheduledTimeMexico = new Date(scheduledDeliveryTime).toLocaleString("en-US", {
                timeZone: "America/Mexico_City",
            });
            const scheduledTime = new Date(scheduledTimeMexico);
            const diffInMinutes = Math.round((scheduledTime.getTime() - now.getTime()) / (1000 * 60));
            estimatedTime = Math.max(diffInMinutes, 0);
        }
        else {
            estimatedTime =
                orderType === "pickup"
                    ? config.estimatedPickupTime
                    : config.estimatedDeliveryTime;
        }
        const newOrder = await models_1.Order.create({
            dailyOrderNumber,
            orderType,
            status: "created",
            totalCost: 0,
            clientId,
            orderDate: today,
            estimatedTime,
            scheduledDeliveryTime,
        });
        if (orderDeliveryInfo) {
            await models_1.OrderDeliveryInfo.create(Object.assign(Object.assign({}, orderDeliveryInfo), { orderId: newOrder.id }));
        }
        const createdItems = await Promise.all(orderItems.map(async (item) => {
            const product = await models_1.Product.findByPk(item.productId);
            if (!product) {
                throw new Error(`Producto no encontrado: ${item.productId}`);
            }
            let itemPrice = product.price || 0;
            if (item.productVariantId) {
                const productVariant = await models_1.ProductVariant.findByPk(item.productVariantId);
                if (!productVariant) {
                    throw new Error(`Variante de producto no encontrada: ${item.productVariantId}`);
                }
                itemPrice = productVariant.price || 0;
            }
            if (item.selectedPizzaIngredients &&
                item.selectedPizzaIngredients.length > 0) {
                let totalIngredientValue = 0;
                let halfIngredientValue = { left: 0, right: 0 };
                for (const ingredient of item.selectedPizzaIngredients) {
                    const pizzaIngredient = await models_1.PizzaIngredient.findByPk(ingredient.pizzaIngredientId);
                    if (!pizzaIngredient) {
                        throw new Error(`Ingrediente de pizza no encontrado en el menu: ${ingredient.pizzaIngredientId}`);
                    }
                    const ingredientValue = ingredient.action === "add"
                        ? pizzaIngredient.ingredientValue
                        : -pizzaIngredient.ingredientValue;
                    if (ingredient.half === "full") {
                        totalIngredientValue += ingredientValue;
                    }
                    else {
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
                const modifierPrices = await Promise.all(item.selectedModifiers.map(async (modifier) => {
                    const mod = await models_1.Modifier.findByPk(modifier.modifierId);
                    return mod.price;
                }));
                itemPrice += modifierPrices.reduce((sum, price) => sum + price, 0);
            }
            const orderItem = await models_1.OrderItem.create({
                quantity: item.quantity,
                price: itemPrice,
                comments: item.comments,
                orderId: newOrder.id,
                productId: item.productId,
                productVariantId: item.productVariantId,
            });
            if (item.selectedModifiers) {
                await Promise.all(item.selectedModifiers.map((modifier) => models_1.SelectedModifier.create({
                    orderItemId: orderItem.id,
                    modifierId: modifier.modifierId,
                })));
            }
            if (item.selectedPizzaIngredients) {
                await Promise.all(item.selectedPizzaIngredients.map((ingredient) => models_1.SelectedPizzaIngredient.create({
                    orderItemId: orderItem.id,
                    pizzaIngredientId: ingredient.pizzaIngredientId,
                    half: ingredient.half,
                    action: ingredient.action,
                })));
            }
            return orderItem;
        }));
        const totalCost = createdItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        await newOrder.update({ totalCost });
        return newOrder;
    }
};
exports.OrderService = OrderService;
exports.OrderService = OrderService = __decorate([
    (0, common_1.Injectable)()
], OrderService);
//# sourceMappingURL=order.service.js.map