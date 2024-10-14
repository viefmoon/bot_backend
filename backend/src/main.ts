import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { json } from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configurar el middleware para el cuerpo raw
  app.use(
    json({
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  await app.listen(5000);
}
bootstrap();
