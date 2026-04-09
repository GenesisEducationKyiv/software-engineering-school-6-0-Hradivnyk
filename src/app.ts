import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { load } from 'js-yaml';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { JsonObject } from 'swagger-ui-express';

import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import logger from './utils/logger.js';
import { pinoHttp } from 'pino-http';
import { config } from './config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: config.app.allowedOrigin,
    methods: ['GET', 'POST'],
  }),
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // maximum 100 requests from the same IP
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true, // adds RateLimit-* headers
  legacyHeaders: false,
});

app.use(limiter);

app.use(pinoHttp({ logger }));

app.use(express.json());

// Swagger
const swaggerDocument = load(
  readFileSync(join(__dirname, '../swagger.yaml'), 'utf8'),
) as JsonObject;
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

export default app;
