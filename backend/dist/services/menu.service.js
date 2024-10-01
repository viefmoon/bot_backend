"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuService = void 0;
const common_1 = require("@nestjs/common");
const models_1 = require("../models");
let MenuService = class MenuService {
    async getMenu() {
        try {
            const menu = await models_1.Product.findAll({
                attributes: {
                    exclude: ["createdAt", "updatedAt", "keywords", "ingredients"],
                },
                include: [
                    {
                        model: models_1.ProductVariant,
                        as: "productVariants",
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "keywords", "ingredients"],
                        },
                        include: [
                            {
                                model: models_1.Availability,
                                attributes: { exclude: ["createdAt", "updatedAt"] },
                            },
                        ],
                    },
                    {
                        model: models_1.Availability,
                        attributes: { exclude: ["createdAt", "updatedAt"] },
                    },
                    {
                        model: models_1.PizzaIngredient,
                        as: "pizzaIngredients",
                        attributes: {
                            exclude: ["createdAt", "updatedAt", "keywords", "ingredients"],
                        },
                        include: [
                            {
                                model: models_1.Availability,
                                attributes: { exclude: ["createdAt", "updatedAt"] },
                            },
                        ],
                    },
                    {
                        model: models_1.ModifierType,
                        as: "modifierTypes",
                        attributes: { exclude: ["createdAt", "updatedAt"] },
                        include: [
                            {
                                model: models_1.Modifier,
                                as: "modifiers",
                                attributes: { exclude: ["createdAt", "updatedAt", "keywords"] },
                                include: [
                                    {
                                        model: models_1.Availability,
                                        attributes: { exclude: ["createdAt", "updatedAt"] },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            });
            return menu;
        }
        catch (error) {
            throw new Error("Error al recuperar el menú");
        }
    }
};
exports.MenuService = MenuService;
exports.MenuService = MenuService = __decorate([
    (0, common_1.Injectable)()
], MenuService);
//# sourceMappingURL=menu.service.js.map