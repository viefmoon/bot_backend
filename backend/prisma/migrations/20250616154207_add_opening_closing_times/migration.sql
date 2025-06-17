-- AlterTable
ALTER TABLE "RestaurantConfig" ADD COLUMN     "closingTime" TEXT NOT NULL DEFAULT '22:00',
ADD COLUMN     "openingTime" TEXT NOT NULL DEFAULT '11:00';
