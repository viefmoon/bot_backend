import { Injectable } from '@nestjs/common';
import { Order, OrderItem, Customer, OrderDeliveryInfo } from '../database/entities';
import { CreateOrderDto } from './dto/create-order.dto';
import logger from '../common/utils/logger';
import { Op } from 'sequelize';

@Injectable()
export class OrderService {
  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    try {
      // Generar el número de orden diario
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const lastOrder = await Order.findOne({
        where: {
          createdAt: {
            [Op.gte]: today
          }
        },
        order: [['dailyOrderNumber', 'DESC']]
      });
      
      const dailyOrderNumber = lastOrder ? lastOrder.dailyOrderNumber + 1 : 1;
      
      // Calcular el costo total (esto debería calcularse basado en los items)
      let totalCost = 0;
      // TODO: Implementar el cálculo del costo total basado en los items
      
      const order = await Order.create({
        orderType: createOrderDto.orderType as "delivery" | "pickup",
        customerId: createOrderDto.customerId,
        scheduledDeliveryTime: createOrderDto.scheduledDeliveryTime ? new Date(createOrderDto.scheduledDeliveryTime) : null,
        status: 'created',
        dailyOrderNumber,
        totalCost,
        estimatedTime: 30, // Valor por defecto, debería calcularse según el tipo de orden
      });
      
      if (createOrderDto.orderItems) {
        await Promise.all(
          createOrderDto.orderItems.map(item => 
            OrderItem.create({
              ...item,
              orderId: order.id,
            })
          )
        );
      }
      
      if (createOrderDto.orderDeliveryInfo) {
        await OrderDeliveryInfo.create({
          ...createOrderDto.orderDeliveryInfo,
          orderId: order.id,
        });
      }
      
      return order;
    } catch (error) {
      logger.error('Error creating order:', error);
      throw error;
    }
  }

  async findOne(id: number): Promise<Order | null> {
    return Order.findByPk(id, {
      include: [OrderItem, Customer, OrderDeliveryInfo],
    });
  }

  async update(id: number, updateData: Partial<Order>): Promise<Order | null> {
    const order = await Order.findByPk(id);
    if (!order) return null;
    
    await order.update(updateData);
    return order;
  }

  async cancel(id: number): Promise<Order | null> {
    return this.update(id, { status: 'canceled' });
  }
}