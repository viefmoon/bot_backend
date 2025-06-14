import { Module } from '@nestjs/common';
import { PreOrderController } from './pre-order.controller';
import { PreOrderService } from './pre-order.service';
import { MenuService } from './menu.service';
import { OrderService } from './order.service';

@Module({
  controllers: [PreOrderController],
  providers: [PreOrderService, MenuService, OrderService],
  exports: [PreOrderService, MenuService, OrderService],
})
export class OrdersModule {}