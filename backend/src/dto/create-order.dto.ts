import {
  IsString,
  IsArray,
  IsOptional,
  IsDateString,
  ValidateNested,
  IsNotEmpty,
} from "class-validator";
import { Type } from "class-transformer";

class OrderItemDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  productVariantId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedPizzaIngredientDto)
  selectedPizzaIngredients: SelectedPizzaIngredientDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedModifierDto)
  selectedModifiers: SelectedModifierDto[];

  @IsNotEmpty()
  quantity: number;

  @IsOptional()
  @IsString()
  comments?: string;
}

class SelectedPizzaIngredientDto {
  @IsString()
  pizzaIngredientId: string;

  @IsString()
  half: string;

  @IsString()
  action: string;
}

class SelectedModifierDto {
  @IsString()
  modifierId: string;
}

class OrderDeliveryInfoDto {
  @IsString()
  streetAddress: string;

  @IsString()
  pickupName: string;
}

export class CreateOrderDto {
  @IsString()
  orderType: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  orderItems: OrderItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderDeliveryInfoDto)
  orderDeliveryInfo?: OrderDeliveryInfoDto;

  @IsString()
  clientId: string;

  @IsOptional()
  @IsDateString()
  scheduledDeliveryTime?: string;
}
