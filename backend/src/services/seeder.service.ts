import { Injectable, OnModuleInit } from "@nestjs/common";
import { seedMenuItems } from "../../seeders/seedMenuItems";
import SeederControl from "../models/seederControl";

@Injectable()
export class SeederService implements OnModuleInit {
  async onModuleInit() {
    try {
      // Asegúrate de que la tabla SeederControl existe
      await SeederControl.sync();
      
      // Ejecuta el seeder
      await seedMenuItems();
    } catch (error) {
      console.error("Error al inicializar el seeder:", error);
    }
  }
}
