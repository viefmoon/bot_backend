import { prisma } from '../server';
import logger from '../utils/logger';

// Banear un cliente
export async function banCustomer(customerId: string) {
  try {
    const customer = await prisma.customer.update({
      where: { customerId },
      data: {
        isBanned: true,
        bannedAt: new Date()
      }
    });
    
    logger.info(`Customer ${customerId} has been banned`);
    return customer;
  } catch (error) {
    logger.error('Error banning customer:', error);
    throw error;
  }
}

// Desbanear un cliente
export async function unbanCustomer(customerId: string) {
  try {
    const customer = await prisma.customer.update({
      where: { customerId },
      data: {
        isBanned: false,
        bannedAt: null
      }
    });
    
    logger.info(`Customer ${customerId} has been unbanned`);
    return customer;
  } catch (error) {
    logger.error('Error unbanning customer:', error);
    throw error;
  }
}

// Verificar si un cliente está baneado
export async function isCustomerBanned(customerId: string): Promise<boolean> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { customerId },
      select: { isBanned: true }
    });
    
    return customer?.isBanned ?? false;
  } catch (error) {
    logger.error('Error checking if customer is banned:', error);
    return false;
  }
}

// Obtener lista de clientes baneados
export async function getBannedCustomers() {
  try {
    return await prisma.customer.findMany({
      where: { isBanned: true },
      orderBy: { bannedAt: 'desc' }
    });
  } catch (error) {
    logger.error('Error fetching banned customers:', error);
    throw error;
  }
}