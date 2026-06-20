import { config } from './config.js';
import logger from './logger.js';
import { NodemailerEmailSender } from './email.sender.js';
import { RetryingEmailSender } from './retrying-email.sender.js';
import { EmailTemplateBuilder } from './email-template.builder.js';
import { EmailService } from './email.service.js';
import { createApp } from './app.js';

const smtpSender = new NodemailerEmailSender({
  host: config.email.host,
  port: config.email.port,
  user: config.email.user,
  pass: config.email.pass,
  from: config.email.from,
});

const emailSender = new RetryingEmailSender(
  smtpSender,
  { attempts: config.retry.attempts, backoffMs: config.retry.backoffMs },
  logger,
);

const emailTemplates = new EmailTemplateBuilder(config.app.baseUrl);
const notifier = new EmailService(emailSender, emailTemplates);

export const app = createApp(notifier, logger);
