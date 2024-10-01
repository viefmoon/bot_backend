"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvailabilityService = void 0;
const common_1 = require("@nestjs/common");
const models_1 = require("../models");
const sequelize_1 = require("sequelize");
let AvailabilityService = class AvailabilityService {
    async toggleAvailability(toggleAvailabilityDto) {
        const { id, type } = toggleAvailabilityDto;
        const availability = await models_1.Availability.findOne({
            where: { id, type },
        });
        if (!availability) {
            throw new common_1.NotFoundException("Availability not found");
        }
        availability.available = !availability.available;
        await availability.save();
        if (type === "product") {
            const product = await models_1.Product.findByPk(id);
            if (product) {
                const productVariantIds = (await models_1.ProductVariant.findAll({
                    where: { productId: id },
                    attributes: ["id"],
                })).map((pv) => pv.id);
                const pizzaIngredientIds = (await models_1.PizzaIngredient.findAll({
                    where: { productId: id },
                    attributes: ["id"],
                })).map((pi) => pi.id);
                const modifierTypeIds = (await models_1.ModifierType.findAll({
                    where: { productId: id },
                    attributes: ["id"],
                })).map((mt) => mt.id);
                const modifierIds = (await models_1.Modifier.findAll({
                    where: { modifierTypeId: modifierTypeIds },
                    attributes: ["id"],
                })).map((m) => m.id);
                if (productVariantIds.length > 0 ||
                    pizzaIngredientIds.length > 0 ||
                    modifierIds.length > 0) {
                    await models_1.Availability.update({ available: availability.available }, {
                        where: {
                            id: {
                                [sequelize_1.Op.or]: [
                                    ...productVariantIds,
                                    ...pizzaIngredientIds,
                                    ...modifierIds,
                                ],
                            },
                        },
                    });
                }
            }
        }
        return {
            id: availability.id,
            type: availability.type,
            available: availability.available,
        };
    }
};
exports.AvailabilityService = AvailabilityService;
exports.AvailabilityService = AvailabilityService = __decorate([
    (0, common_1.Injectable)()
], AvailabilityService);
//# sourceMappingURL=availability.service.js.map