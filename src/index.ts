import 'dotenv/config';
import cron from 'node-cron';
import app from './app.js';
import { config } from './config/index.js';
import { scannerService } from './container.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 3000;

if (!cron.validate(config.scanner.cronSchedule)) {
  throw new Error(
    `Invalid cron schedule: "${config.scanner.cronSchedule}". Check SCANNER_CRON_SCHEDULE in your .env file.`,
  );
}

app.listen(PORT, () => {
  logger.info({ event: 'server.started', port: PORT }, 'Server started');
  scannerService.start();
});
