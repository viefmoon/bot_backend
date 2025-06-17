/*
  Warnings:

  - You are about to drop the column `closingTime` on the `RestaurantConfig` table. All the data in the column will be lost.
  - You are about to drop the column `openingTime` on the `RestaurantConfig` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RestaurantConfig" DROP COLUMN "closingTime",
DROP COLUMN "openingTime",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "centerLatitude" DOUBLE PRECISION,
ADD COLUMN     "centerLongitude" DOUBLE PRECISION,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "closingGracePeriod" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "deliveryCoverageArea" JSONB,
ADD COLUMN     "openingGracePeriod" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "phoneMain" TEXT,
ADD COLUMN     "phoneSecondary" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "restaurantName" TEXT NOT NULL DEFAULT 'La Leña',
ADD COLUMN     "state" TEXT,
ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'America/Mexico_City';

-- CreateTable
CREATE TABLE "BusinessHours" (
    "id" SERIAL NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openingTime" TEXT,
    "closingTime" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "restaurantConfigId" INTEGER NOT NULL,

    CONSTRAINT "BusinessHours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessHours_restaurantConfigId_dayOfWeek_key" ON "BusinessHours"("restaurantConfigId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "BusinessHours" ADD CONSTRAINT "BusinessHours_restaurantConfigId_fkey" FOREIGN KEY ("restaurantConfigId") REFERENCES "RestaurantConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
