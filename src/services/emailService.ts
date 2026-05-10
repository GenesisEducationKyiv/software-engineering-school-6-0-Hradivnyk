import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

export interface IEmailService {
  sendConfirmationEmail(
    email: string,
    token: string,
    repo: string,
  ): Promise<void>;
  sendNotificationEmail(
    email: string,
    repo: string,
    tag: string,
    token: string,
  ): Promise<void>;
}

export class EmailService implements IEmailService {
  private readonly transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });

  async sendConfirmationEmail(
    email: string,
    token: string,
    repo: string,
  ): Promise<void> {
    const confirmUrl = `${config.app.baseUrl}/api/confirm/${token}`;

    await this.transporter.sendMail({
      from: config.email.from,
      to: email,
      subject: `Confirm your subscription to ${repo}`,
      text: [
        `You requested to subscribe to GitHub release notifications for: ${repo}`,
        '',
        'To confirm your subscription, click the link below:',
        confirmUrl,
        '',
        'If you did not make this request, ignore this email.',
      ].join('\n'),
    });
  }

  async sendNotificationEmail(
    email: string,
    repo: string,
    tag: string,
    token: string,
  ): Promise<void> {
    const unsubscribeUrl = `${config.app.baseUrl}/api/unsubscribe/${token}`;

    await this.transporter.sendMail({
      from: config.email.from,
      to: email,
      subject: `New release of ${repo}: ${tag}`,
      text: [
        `A new release of ${repo} is available: ${tag}`,
        '',
        'To unsubscribe from notifications for this repository, follow this link:',
        unsubscribeUrl,
      ].join('\n'),
    });
  }
}
