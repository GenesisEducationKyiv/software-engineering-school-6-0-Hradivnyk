import 'dotenv/config';
import app from './app.js';
import { scannerService } from './services/scannerService.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info({ event: 'server.started', port: PORT }, 'Server started');
  scannerService.start();
});
