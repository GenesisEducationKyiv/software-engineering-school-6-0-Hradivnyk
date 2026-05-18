import type { IEmailSender } from './emailSender.js';
import type { IEmailTemplateBuilder } from './emailTemplateBuilder.js';

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
  constructor(
    private readonly sender: IEmailSender,
    private readonly templates: IEmailTemplateBuilder,
  ) {}

  async sendConfirmationEmail(
    email: string,
    token: string,
    repo: string,
  ): Promise<void> {
    await this.sender.send(
      this.templates.confirmationEmail(email, token, repo),
    );
  }

  async sendNotificationEmail(
    email: string,
    repo: string,
    tag: string,
    token: string,
  ): Promise<void> {
    await this.sender.send(
      this.templates.notificationEmail(email, repo, tag, token),
    );
  }
}
