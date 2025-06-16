import { IsEnum, IsNotEmpty, IsNumber } from "class-validator";

export class ToggleAvailabilityDto {
  @IsNotEmpty()
  @IsNumber()
  id: number;

  @IsNotEmpty()
  @IsEnum([
    "product",
    "productVariant",
    "modifier",
    "modifierType",
    "pizzaIngredient",
  ])
  entityType: string;
}
