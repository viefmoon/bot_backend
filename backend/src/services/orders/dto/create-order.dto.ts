import {
  IsString,
  IsArray,
  IsOptional,
  IsDateString,
  ValidateNested,
  IsNotEmpty,
  IsNumber,
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
  @IsNumber()
  @IsOptional()
  id?: number;

  @IsString()
  @IsOptional()
  streetAddress?: string;

  @IsString()
  @IsOptional()
  neighborhood?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  pickupName?: string;

  @IsString()
  @IsOptional()
  geocodedAddress?: string;

  @IsString()
  @IsOptional()
  additionalDetails?: string;

  @IsNumber()
  @IsOptional()
  preOrderId?: number;

  @IsNumber()
  @IsOptional()
  orderId?: number;
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
  customerId: string;

  @IsOptional()
  @IsDateString()
  scheduledDeliveryTime?: string;
}
