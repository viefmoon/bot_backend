import {
  IsString,
  IsArray,
  IsOptional,
  IsDateString,
  ValidateNested,
  IsNotEmpty,
  IsNumber,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";
import { OrderType } from '@prisma/client';

class OrderItemDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  productVariantId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedPizzaCustomizationDto)
  selectedPizzaCustomizations: SelectedPizzaCustomizationDto[];

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

class SelectedPizzaCustomizationDto {
  @IsString()
  pizzaCustomizationId: string;

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
  street?: string;

  @IsString()
  @IsOptional()
  number?: string;

  @IsString()
  @IsOptional()
  interiorNumber?: string;

  @IsString()
  @IsOptional()
  neighborhood?: string;

  @IsString()
  @IsOptional()
  zipCode?: string;

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
  references?: string;

  @IsNumber()
  @IsOptional()
  preOrderId?: number;

  @IsNumber()
  @IsOptional()
  orderId?: number;
}

export class CreateOrderDto {
  @IsEnum(OrderType, { message: 'orderType must be a valid OrderType enum value' })
  orderType: OrderType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  orderItems: OrderItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderDeliveryInfoDto)
  orderDeliveryInfo?: OrderDeliveryInfoDto;

  @IsString()
  whatsappPhoneNumber: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
