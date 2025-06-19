/*
  Warnings:

  - You are about to drop the column `dailyOrderNumber` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `finishedAt` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledDeliveryTime` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `customerId` on the `PreOrder` table. All the data in the column will be lost.
  - You are about to drop the column `scheduledDeliveryTime` on the `PreOrder` table. All the data in the column will be lost.
  - Added the required column `dailyNumber` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `whatsappPhoneNumber` to the `PreOrder` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "PreOrder" DROP CONSTRAINT "PreOrder_customerId_fkey";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "dailyOrderNumber",
DROP COLUMN "finishedAt",
DROP COLUMN "scheduledDeliveryTime",
DROP COLUMN "status",
ADD COLUMN     "dailyNumber" INTEGER NOT NULL,
ADD COLUMN     "isFromWhatsApp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "orderStatus" "OrderStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "scheduledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PreOrder" DROP COLUMN "customerId",
DROP COLUMN "scheduledDeliveryTime",
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "whatsappPhoneNumber" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "PreOrder_whatsappPhoneNumber_idx" ON "PreOrder"("whatsappPhoneNumber");
