const { DataTypes } = require('sequelize');
const sequelize = require('../lib/db');

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

module.exports = RestaurantConfig;