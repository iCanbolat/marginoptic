import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { getQueueToken } from "@nestjs/bullmq";
import type { INestApplication } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import type { Queue } from "bullmq";

interface SimpleLogger {
  log(message: string): void;
}

const QUEUE_NAMES = [
  "shopify-sync",
  "webhooks",
  "token-refresh",
  "metrics-rollup",
  "recurring-expenses",
  "ads-sync",
  "fx-rates",
];

const BASE_PATH = "/admin/queues";

/** Basic-auth ara katmanı (BULL_BOARD_PASSWORD tanımlıysa zorunlu). */
function basicAuth(user: string, pass: string) {
  const expected =
    "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.headers.authorization === expected) return next();
    res.setHeader("WWW-Authenticate", 'Basic realm="bull-board"');
    res.status(401).send("Yetkisiz");
  };
}

/**
 * Faz 9 — Bull-Board kuyruk panosu. `/admin/queues` altında BullMQ kuyruklarını
 * gösterir. Üretimde yalnız `BULL_BOARD_ENABLED=true` ile; parola tanımlıysa
 * (BULL_BOARD_USER/PASSWORD) basic-auth korumalı. Mevcut olmayan kuyruklar atlanır.
 */
export function mountBullBoard(app: INestApplication, logger: SimpleLogger): boolean {
  const isProd = process.env.NODE_ENV === "production";
  const enabled = process.env.BULL_BOARD_ENABLED === "true" || !isProd;
  if (!enabled) return false;

  const queues: BullMQAdapter[] = [];
  for (const name of QUEUE_NAMES) {
    try {
      const queue = app.get<Queue>(getQueueToken(name), { strict: false });
      if (queue) queues.push(new BullMQAdapter(queue));
    } catch {
      // kuyruk kayıtlı değilse atla
    }
  }
  if (queues.length === 0) return false;

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(BASE_PATH);
  createBullBoard({ queues, serverAdapter });

  const user = process.env.BULL_BOARD_USER;
  const pass = process.env.BULL_BOARD_PASSWORD;
  const httpAdapter = app.getHttpAdapter().getInstance() as {
    use: (path: string, ...handlers: unknown[]) => void;
  };
  const handlers: unknown[] = [];
  if (user && pass) handlers.push(basicAuth(user, pass));
  handlers.push(serverAdapter.getRouter());
  httpAdapter.use(BASE_PATH, ...handlers);

  logger.log(`Bull-Board kuyruk panosu: ${BASE_PATH} (${queues.length} kuyruk)`);
  return true;
}
