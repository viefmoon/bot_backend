import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

interface NotificationPhoneAttributes {
  id?: number;
  phoneNumber: string;
  isActive: boolean;
}

class NotificationPhone
  extends Model<NotificationPhoneAttributes>
  implements NotificationPhoneAttributes
{
  public id!: number;
  public phoneNumber!: string;
  public isActive!: boolean;
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
    tableName: "NotificationPhones",
    timestamps: false,
  }
);

export default NotificationPhone;
