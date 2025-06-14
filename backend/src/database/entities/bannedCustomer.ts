import { DataTypes, Model } from "sequelize";
import { sequelize } from "../db";

interface BannedCustomerAttributes {
  id: number;
  customerId: string;
  bannedAt: Date;
}

class BannedCustomer
  extends Model<BannedCustomerAttributes>
  implements BannedCustomerAttributes
{
  public id!: number;
  public customerId!: string;
  public bannedAt!: Date;
}

BannedCustomer.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customerId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    bannedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: "BannedCustomer",
    tableName: "BannedCustomers",
    timestamps: true,
  }
);

export default BannedCustomer;
