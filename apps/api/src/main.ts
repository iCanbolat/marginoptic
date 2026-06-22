import "reflect-metadata";
// Observability ilk import (OTel auto-instrumentation izlenen modüllerden önce başlamalı).
import "./observability/init";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { mountBullBoard } from "./observability/bull-board";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const logger = app.get(Logger);
  app.useLogger(logger);
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const config = app.get(ConfigService);
  app.enableCors({ origin: config.get<string>("WEB_ORIGIN"), credentials: true });
  app.setGlobalPrefix("api", { exclude: ["health", "ready"] });
  app.enableShutdownHooks();

  // Bull-Board kuyruk panosu (/admin/queues) — env-gated.
  mountBullBoard(app, logger);

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Churnify API")
    .setDescription("Çok kanallı gerçek net kâr analitiği API")
    .setVersion("0.0.1")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = config.getOrThrow<number>("PORT");
  await app.listen(port);
  logger.log(`Churnify API → http://localhost:${port} (docs: /docs)`);
}

void bootstrap();
