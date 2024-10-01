import { IsEnum, IsNotEmpty, IsString } from "class-validator";

export class ToggleAvailabilityDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsEnum([
    "product",
    "productVariant",
    "modifier",
    "modifierType",
    "pizzaIngredient",
  ])
  type: string;
}
