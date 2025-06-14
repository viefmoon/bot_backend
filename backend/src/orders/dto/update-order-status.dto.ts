import { IsString, IsNotEmpty } from "class-validator";

export class UpdateOrderStatusDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  newStatus: string;
}
