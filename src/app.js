import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { load } from 'js-yaml';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(express.json());

// Swagger
const swaggerDocument = load(
  readFileSync(join(__dirname, '../swagger.yaml'), 'utf8')
);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default app;
