const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.MYSQL_DATABASE, process.env.MYSQL_USER, process.env.MYSQL_PASSWORD, {
    host: process.env.MYSQL_HOST,
    dialect: 'mysql',
    logging: false, // Desactivar logging en producción
});

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        // Sincronizar modelos con la base de datos
        if (process.env.NODE_ENV === 'development') {
            await sequelize.sync({ alter: true }); // Usar alter en desarrollo
        } else {
            await sequelize.sync(); // Sin alter en producción
        }

        console.log('All models were synchronized successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};

module.exports = { sequelize, connectDB };