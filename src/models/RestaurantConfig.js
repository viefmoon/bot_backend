const { DataTypes } = require('sequelize');
const { sequelize } = require('../lib/db');

const RestaurantConfig = sequelize.define('RestaurantConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  acceptingOrders: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  estimatedPickupTime: {
    type: DataTypes.INTEGER,
    defaultValue: 20,
    comment: 'Tiempo estimado de recolección en minutos'
  },
  estimatedDeliveryTime: {
    type: DataTypes.INTEGER,
    defaultValue: 40,
    comment: 'Tiempo estimado de entrega a domicilio en minutos'
  }
});

// Método para crear una configuración por defecto si no existe
RestaurantConfig.sync().then(async () => {
  const count = await RestaurantConfig.count();
  if (count === 0) {
    await RestaurantConfig.create({
      acceptingOrders: true,
      estimatedPickupTime: 20,
      estimatedDeliveryTime: 40
    });
    console.log('Configuración por defecto creada.');
  }
});

module.exports = RestaurantConfig;