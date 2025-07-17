import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// Handle cleanup on process termination
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});