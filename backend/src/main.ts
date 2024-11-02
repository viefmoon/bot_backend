import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { json } from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Agregar el prefijo global /api
  app.setGlobalPrefix("backend");

  // Habilitar CORS si es necesario
  app.enableCors({
    origin: ["https://pizzatototlan.store", "http://localhost:3000"],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  });

  // Configurar el middleware para el cuerpo raw
  app.use(
    json({
      verify: (req: any, res, buf) => {
        if (req.url.includes("/webhook")) {
          // Solo para rutas de webhook
          req.rawBody = buf.toString();
        }
      },
    })
  );

  await app.listen(5000);
}
bootstrap();
