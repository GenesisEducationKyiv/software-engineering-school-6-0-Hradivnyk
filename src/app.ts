import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { load } from 'js-yaml';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { JsonObject } from 'swagger-ui-express';

import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import logger from './utils/logger.js';
import { pinoHttp } from 'pino-http';
import { config } from './config/index.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiKeyAuth } from './middleware/apiKeyAuth.js';

const app = express();

app.use(express.static(resolve(process.cwd(), 'public')));

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
  readFileSync(resolve(process.cwd(), 'swagger.yaml'), 'utf8'),
) as JsonObject;
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(express.urlencoded({ extended: false }));

app.use('/api', apiKeyAuth, subscriptionRoutes);

app.use(errorHandler);

export default app;
