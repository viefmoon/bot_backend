-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('delivery', 'pickup');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('created', 'accepted', 'in_preparation', 'prepared', 'in_delivery', 'finished', 'canceled');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid');

-- CreateEnum
CREATE TYPE "PizzaHalf" AS ENUM ('left', 'right', 'full');

-- CreateEnum
CREATE TYPE "IngredientAction" AS ENUM ('add', 'remove');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "customerId" TEXT NOT NULL,
    "fullChatHistory" JSONB,
    "relevantChatHistory" JSONB,
    "stripeCustomerId" TEXT,
    "lastInteraction" TIMESTAMP(3),
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "bannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("customerId")
);

-- CreateTable
CREATE TABLE "CustomerDeliveryInfo" (
    "id" SERIAL NOT NULL,
    "customerId" TEXT NOT NULL,
    "streetAddress" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "pickupName" TEXT,
    "geocodedAddress" TEXT,
    "additionalDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerDeliveryInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" SERIAL NOT NULL,
    "messageId" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageRateLimit" (
    "id" SERIAL NOT NULL,
    "customerId" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageRateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modifier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "modifierTypeId" TEXT NOT NULL,
    "shortName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Modifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModifierType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "acceptsMultiple" BOOLEAN NOT NULL DEFAULT false,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "productId" TEXT NOT NULL,

    CONSTRAINT "ModifierType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "dailyOrderNumber" INTEGER NOT NULL,
    "orderType" "OrderType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'created',
    "paymentStatus" "PaymentStatus",
    "totalCost" DOUBLE PRECISION NOT NULL,
    "customerId" TEXT NOT NULL,
    "estimatedTime" INTEGER NOT NULL DEFAULT 0,
    "scheduledDeliveryTime" TIMESTAMP(3),
    "messageId" TEXT,
    "stripeSessionId" TEXT,
    "finishedAt" TIMESTAMP(3),
    "syncedWithLocal" BOOLEAN NOT NULL DEFAULT false,
    "localId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderDeliveryInfo" (
    "id" SERIAL NOT NULL,
    "streetAddress" TEXT,
    "neighborhood" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "pickupName" TEXT,
    "geocodedAddress" TEXT,
    "additionalDetails" TEXT,
    "preOrderId" INTEGER,
    "orderId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderDeliveryInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DOUBLE PRECISION NOT NULL,
    "comments" TEXT,
    "orderId" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "productVariantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PizzaIngredient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ingredientValue" INTEGER NOT NULL DEFAULT 1,
    "productId" TEXT NOT NULL,
    "ingredients" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PizzaIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreOrder" (
    "id" SERIAL NOT NULL,
    "orderItems" JSONB NOT NULL,
    "orderType" "OrderType" NOT NULL,
    "scheduledDeliveryTime" TIMESTAMP(3),
    "customerId" TEXT NOT NULL,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "price" DOUBLE PRECISION,
    "ingredients" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "subcategoryId" TEXT NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "productId" TEXT NOT NULL,
    "ingredients" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantConfig" (
    "id" SERIAL NOT NULL,
    "acceptingOrders" BOOLEAN NOT NULL DEFAULT true,
    "estimatedPickupTime" INTEGER NOT NULL DEFAULT 20,
    "estimatedDeliveryTime" INTEGER NOT NULL DEFAULT 40,

    CONSTRAINT "RestaurantConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeederControl" (
    "id" TEXT NOT NULL,
    "lastRun" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeederControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelectedModifier" (
    "id" SERIAL NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "modifierId" TEXT NOT NULL,

    CONSTRAINT "SelectedModifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelectedPizzaIngredient" (
    "id" SERIAL NOT NULL,
    "half" "PizzaHalf" NOT NULL DEFAULT 'full',
    "pizzaIngredientId" TEXT NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "action" "IngredientAction" NOT NULL DEFAULT 'add',

    CONSTRAINT "SelectedPizzaIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subcategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Subcategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_customerId_key" ON "Customer"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_stripeCustomerId_key" ON "Customer"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerDeliveryInfo_customerId_key" ON "CustomerDeliveryInfo"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageLog_messageId_key" ON "MessageLog"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageRateLimit_customerId_key" ON "MessageRateLimit"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderDeliveryInfo_orderId_key" ON "OrderDeliveryInfo"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Subcategory_name_key" ON "Subcategory"("name");

-- AddForeignKey
ALTER TABLE "CustomerDeliveryInfo" ADD CONSTRAINT "CustomerDeliveryInfo_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Modifier" ADD CONSTRAINT "Modifier_modifierTypeId_fkey" FOREIGN KEY ("modifierTypeId") REFERENCES "ModifierType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModifierType" ADD CONSTRAINT "ModifierType_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDeliveryInfo" ADD CONSTRAINT "OrderDeliveryInfo_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDeliveryInfo" ADD CONSTRAINT "OrderDeliveryInfo_preOrderId_fkey" FOREIGN KEY ("preOrderId") REFERENCES "PreOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PizzaIngredient" ADD CONSTRAINT "PizzaIngredient_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectedModifier" ADD CONSTRAINT "SelectedModifier_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectedModifier" ADD CONSTRAINT "SelectedModifier_modifierId_fkey" FOREIGN KEY ("modifierId") REFERENCES "Modifier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectedPizzaIngredient" ADD CONSTRAINT "SelectedPizzaIngredient_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectedPizzaIngredient" ADD CONSTRAINT "SelectedPizzaIngredient_pizzaIngredientId_fkey" FOREIGN KEY ("pizzaIngredientId") REFERENCES "PizzaIngredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcategory" ADD CONSTRAINT "Subcategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
