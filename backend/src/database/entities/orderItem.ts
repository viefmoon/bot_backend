import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db";
import Product from "./product";
import ProductVariant from "./productVariant";
import Order from "./order";
import SelectedModifier from "./selectedModifier";
import SelectedPizzaIngredient from "./selectedPizzaIngredient";

interface OrderItemAttributes {
  id: number;
  quantity: number;
  price: number;
  comments?: string;
  orderId: number;
  productId: string;
  productVariantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface OrderItemCreationAttributes
  extends Optional<OrderItemAttributes, "id" | "createdAt" | "updatedAt"> {}

class OrderItem
  extends Model<OrderItemAttributes, OrderItemCreationAttributes>
  implements OrderItemAttributes
{
  public id!: number;
  public quantity!: number;
  public price!: number;
  public comments!: string | undefined;
  public orderId!: number;
  public productId!: string;
  public productVariantId!: string | undefined;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public order?: Order;
  public product?: Product;
  public productVariant?: ProductVariant;
  public selectedModifiers?: SelectedModifier[];
  public selectedPizzaIngredients?: SelectedPizzaIngredient[];
}

OrderItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    comments: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Orders",
        key: "id",
      },
    },
    productId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: "Products",
        key: "id",
      },
    },
    productVariantId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: "ProductVariants",
        key: "id",
      },
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "OrderItem",
    tableName: "OrderItems",
    timestamps: true,
  }
);

export default OrderItem;
