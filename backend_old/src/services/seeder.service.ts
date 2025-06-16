import { Injectable, OnModuleInit } from "@nestjs/common";
import { seedMenuItems } from "../../seeders/seedMenuItems";

@Injectable()
export class SeederService implements OnModuleInit {
  async onModuleInit() {
    try {
      // Ejecuta el seeder
      await seedMenuItems();
    } catch (error) {
      console.error("Error al inicializar el seeder:", error);
    }
  }
}
