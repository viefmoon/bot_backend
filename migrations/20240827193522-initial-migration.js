"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Availabilities", {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
      },
      type: {
        type: Sequelize.ENUM(
          "product",
          "variant",
          "modifier",
          "pizzaIngredient",
          "modifierType"
        ),
        allowNull: false,
      },
      available: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.createTable("Customers", {
      clientId: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true,
        unique: true,
      },
      lastDeliveryAddress: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      lastPickupName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.createTable("Products", {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      price: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.createTable("ProductVariants", {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      price: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      productId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: "Products",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.createTable("ModifierTypes", {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      acceptsMultiple: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      productId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: "Products",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.createTable("Modifiers", {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      price: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      modifierTypeId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: "ModifierTypes",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.createTable("PizzaIngredients", {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      ingredientValue: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      productId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: "Products",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.createTable("Orders", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      dailyOrderNumber: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      orderType: {
        type: Sequelize.ENUM("delivery", "pickup"),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM(
          "created",
          "in_preparation",
          "prepared",
          "in_delivery",
          "finished",
          "canceled"
        ),
        allowNull: false,
        defaultValue: "created",
      },
      phoneNumber: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      deliveryAddress: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      customerName: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      totalCost: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      clientId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      orderDate: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      estimatedTime: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      scheduledDeliveryTime: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.createTable("OrderItems", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      price: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      comments: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      orderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "Orders",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      productId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: "Products",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      productVariantId: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: "ProductVariants",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.createTable("SelectedPizzaIngredients", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      half: {
        type: Sequelize.ENUM("left", "right", "none"),
        allowNull: false,
        defaultValue: "none",
      },
      pizzaIngredientId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: "PizzaIngredients",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      orderItemId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "OrderItems",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.createTable("SelectedModifiers", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      orderItemId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "OrderItems",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      modifierId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: "Modifiers",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    await queryInterface.createTable("RestaurantConfigs", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      acceptingOrders: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },
      estimatedPickupTime: {
        type: Sequelize.INTEGER,
        defaultValue: 20,
      },
      estimatedDeliveryTime: {
        type: Sequelize.INTEGER,
        defaultValue: 40,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("SelectedModifiers");
    await queryInterface.dropTable("SelectedPizzaIngredients");
    await queryInterface.dropTable("OrderItems");
    await queryInterface.dropTable("Orders");
    await queryInterface.dropTable("PizzaIngredients");
    await queryInterface.dropTable("Modifiers");
    await queryInterface.dropTable("ModifierTypes");
    await queryInterface.dropTable("ProductVariants");
    await queryInterface.dropTable("Products");
    await queryInterface.dropTable("Customers");
    await queryInterface.dropTable("Availabilities");
    await queryInterface.dropTable("RestaurantConfigs");
  },
};