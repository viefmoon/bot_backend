import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { json } from "express";
import express from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Modificar el middleware para raw body en rutas de Stripe
  app.use(
    "/backend/webhook",
    express.raw({
      type: "application/json",
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  // Configuración regular de body parser para otras rutas
  app.use(json());

  // Agregar el prefijo global /api
  app.setGlobalPrefix("backend");

  // Habilitar CORS si es necesario
  app.enableCors({
    origin: ["https://pizzatototlan.store", "http://localhost:3000"],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  });

  await app.listen(5000);
}
bootstrap();
