import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

interface NotificationPhoneAttributes {
  id?: number;
  phoneNumber: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

class NotificationPhone
  extends Model<NotificationPhoneAttributes>
  implements NotificationPhoneAttributes
{
  public id!: number;
  public phoneNumber!: string;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

NotificationPhone.init(
  {
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: "NotificationPhone",
    timestamps: true,
  }
);

export default NotificationPhone;
