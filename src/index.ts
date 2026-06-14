import 'dotenv/config';
import cron from 'node-cron';
import app from './app.js';
import { config } from './platform/config/index.js';
import { scannerService } from './container.js';
import logger from './platform/logger.js';

const PORT = process.env.PORT || 3000;

if (!cron.validate(config.scanner.cronSchedule)) {
  throw new Error(
    `Invalid cron schedule: "${config.scanner.cronSchedule}". Check SCANNER_CRON_SCHEDULE in your .env file.`,
  );
}

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);

  cron.schedule(config.scanner.cronSchedule, () => {
    scannerService.scan().catch((err: unknown) => {
      logger.error({ err }, 'Scanner: unhandled error during scan');
    });
  });

  logger.info({ schedule: config.scanner.cronSchedule }, 'Scanner: scheduled');
});
