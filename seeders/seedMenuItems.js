require('dotenv').config();
const { sequelize } = require('../src/lib/db');
const MenuItem = require('../src/models/MenuItem');

const menuItems = [
  { code: "E001", name: "Alitas", available: true },
  { code: "E002", name: "Ordenes de Papas", available: true },
  { code: "E002-V001", name: "Orden de Papas a la Francesa", available: true },
  { code: "E002-V002", name: "Orden de Papas Gajo", available: true },
  { code: "E002-V003", name: "Orden de Papas Mixtas (francesa y gajos)", available: false },
  { code: "E003", name: "Dedos de Queso", available: true },
  { code: "E004-V001", name: "Ensalada de Pollo", available: true },
  { code: "E004-V001-T001", name: "Ensalada de Pollo Chica", available: true },
  { code: "E004-V001-T002", name: "Ensalada de Pollo Grande", available: true },
  { code: "I001", name: "Pollo a la plancha", available: true },
  { code: "I002", name: "Chile morrón", available: true },
  { code: "I003", name: "Elote", available: true },
  { code: "I004", name: "Lechuga", available: true },
  { code: "I005", name: "Jitomate", available: true },
  { code: "I006", name: "Zanahoria", available: true },
  { code: "I007", name: "Queso parmesano", available: true },
  { code: "I008", name: "Aderezo", available: true },
  { code: "I009", name: "Betabel crujiente", available: true },
  { code: "I010", name: "Extra pollo", available: true },
  { code: "I011", name: "Con queso gouda", available: true },
  { code: "I012", name: "Con vinagreta", available: true },
  { code: "I013", name: "Con jamón", available: true },
  { code: "I014", name: "Queso manchego", available: true },
  { code: "I015", name: "Pepperoni", available: true },
  { code: "I016", name: "Salchicha", available: true },
  { code: "I017", name: "Salami", available: true },
  { code: "I018", name: "Chorizo", available: true },
  { code: "I019", name: "Piña", available: true },
  { code: "I020", name: "Champiñón", available: true },
  { code: "I021", name: "Tocino", available: true },
  { code: "I022", name: "Chile jalapeño", available: true },
  { code: "I023", name: "3 Quesos", available: true },
  { code: "I024", name: "Albahaca", available: true },
  { code: "I025", name: "Arándano", available: true },
  { code: "I026", name: "Cebolla", available: true },
  { code: "I027", name: "Calabaza", available: true },
  { code: "I028", name: "Carne molida", available: true },
  { code: "I029", name: "Pierna", available: true },
  { code: "I030", name: "Pollo BBQ", available: true },
  { code: "I031", name: "Queso de cabra", available: true },
  { code: "I032", name: "Chile seco", available: true },
  { code: "I033", name: "Queso philadelphia", available: true },
  { code: "P001-T001", name: "Pizza Chica", available: true },
  { code: "P001-T002", name: "Pizza Mediana", available: true },
  { code: "P001-T003", name: "Pizza Grande", available: true },
  { code: "O001", name: "Orilla rellena de queso", available: true },
  { code: "O002", name: "Orilla rellena de pepperoni", available: true },
  { code: "O003", name: "Orilla rellena de jalapeño", available: true },
  { code: "P001", name: "Pizza Especial", available: true },
  { code: "P002", name: "Pizza Carnes Frías", available: true },
  { code: "P003", name: "Pizza Carranza", available: true },
  { code: "P004", name: "Pizza Zapata", available: true },
  { code: "P005", name: "Pizza Villa", available: true },
  { code: "P006", name: "Pizza Margarita", available: true },
  { code: "P007", name: "Pizza Adelita", available: true },
  { code: "P008", name: "Pizza Hawaiana", available: true },
  { code: "P009", name: "Pizza Mexicana", available: true },
  { code: "P010", name: "Pizza Rivera", available: true },
  { code: "P011", name: "Pizza Kahlo", available: true },
  { code: "P012", name: "Pizza Lupita", available: true },
  { code: "P013", name: "Pizza Pepperoni", available: true },
  { code: "P014", name: "Pizza La Leña", available: true },
  { code: "P015", name: "Pizza La María", available: true },
  { code: "P016", name: "Pizza Malinche", available: true },
  { code: "P017", name: "Pizza Philadelphia", available: true },
];

const seedMenuItems = async () => {
  try {
    await sequelize.sync({ alter: true });
    await MenuItem.bulkCreate(menuItems, { ignoreDuplicates: true });
    console.log('Menu items have been seeded successfully.');
  } catch (error) {
    console.error('Error seeding menu items:', error);
  } finally {
    await sequelize.close();
  }
};

seedMenuItems();