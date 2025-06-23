import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateAddressNames() {
  try {
    // Update all addresses without names to have a default name
    const result = await prisma.address.updateMany({
      where: {
        name: null
      },
      data: {
        name: 'Dirección principal'
      }
    });

    console.log(`Updated ${result.count} addresses with default names`);
  } catch (error) {
    console.error('Error updating addresses:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAddressNames();