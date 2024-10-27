import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

interface BannedCustomerAttributes {
  clientId: string;
  bannedAt: Date;
}

class BannedCustomer
  extends Model<BannedCustomerAttributes>
  implements BannedCustomerAttributes
{
  public clientId!: string;
  public bannedAt!: Date;
}

BannedCustomer.init(
  {
    clientId: {
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
    timestamps: true,
  }
);

export default BannedCustomer;
