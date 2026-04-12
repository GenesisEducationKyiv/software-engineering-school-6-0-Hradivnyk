import 'dotenv/config';
import app from './app.js';
import { scannerService } from './services/scannerService.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  scannerService.start();
});
