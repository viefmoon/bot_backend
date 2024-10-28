import { Injectable, NotFoundException } from "@nestjs/common";
import { ToggleAvailabilityDto } from "../dto/toggle-availability.dto";
import {
  Availability,
  Product,
  ProductVariant,
  Modifier,
  ModifierType,
  PizzaIngredient,
} from "../models";
import { Op } from "sequelize";

@Injectable()
export class AvailabilityService {
  async toggleAvailability(toggleAvailabilityDto: ToggleAvailabilityDto) {
    const { id, entityType } = toggleAvailabilityDto;

    const availability = await Availability.findOne({
      where: { id },
    });

    if (!availability) {
      throw new NotFoundException("Availability not found");
    }

    availability.available = !availability.available;
    await availability.save();

    // Si es un producto, actualizar la disponibilidad de sus relaciones
    if (entityType === "product") {
      // Buscar el producto usando el entityId de la disponibilidad
      const product = await Product.findByPk(availability.entityId);
      if (product) {
        // Obtener IDs de todas las relaciones
        const productVariantIds = (
          await ProductVariant.findAll({
            where: { productId: availability.entityId },
            attributes: ["id"],
          })
        ).map((pv) => pv.id);

        const pizzaIngredientIds = (
          await PizzaIngredient.findAll({
            where: { productId: availability.entityId },
            attributes: ["id"],
          })
        ).map((pi) => pi.id);

        const modifierTypeIds = (
          await ModifierType.findAll({
            where: { productId: availability.entityId },
            attributes: ["id"],
          })
        ).map((mt) => mt.id);

        const modifierIds = (
          await Modifier.findAll({
            where: { modifierTypeId: modifierTypeIds },
            attributes: ["id"],
          })
        ).map((m) => m.id);

        // Verificar si el producto tiene relaciones
        if (
          productVariantIds.length > 0 ||
          pizzaIngredientIds.length > 0 ||
          modifierIds.length > 0
        ) {
          // Actualizar Availability solo para las relaciones existentes
          await Availability.update(
            { available: availability.available },
            {
              where: {
                id: {
                  [Op.or]: [
                    ...productVariantIds,
                    ...pizzaIngredientIds,
                    ...modifierIds,
                  ],
                },
              },
            }
          );
        }
      }
    }

    return {
      id: availability.id,
      entityType: availability.entityType,
      available: availability.available,
    };
  }
}
