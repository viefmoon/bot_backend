import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { NotificationPhone } from "../models";

@Injectable()
export class NotificationPhoneService {
  async getPhones() {
    return NotificationPhone.findAll({
      attributes: ["id", "phoneNumber", "isActive"],
    });
  }

  async addPhone(phoneNumber: string) {
    const [phone, created] = await NotificationPhone.findOrCreate({
      where: { phoneNumber },
      defaults: { isActive: true },
    });
    if (!created) {
      throw new ConflictException("El número de teléfono ya existe");
    }
    return phone;
  }

  async updatePhone(
    id: string,
    phoneData: { phoneNumber: string; isActive: boolean }
  ) {
    const [updatedCount] = await NotificationPhone.update(phoneData, {
      where: { id },
    });
    if (updatedCount === 0) {
      throw new NotFoundException("Número de teléfono no encontrado");
    }
    return NotificationPhone.findByPk(id);
  }

  async deletePhone(id: string) {
    const deletedCount = await NotificationPhone.destroy({ where: { id } });
    if (deletedCount === 0) {
      throw new NotFoundException("Número de teléfono no encontrado");
    }
    return { message: "Número de teléfono eliminado con éxito" };
  }
}
