import { InMemoryBroker } from '@release-owl/platform';
import { EMAIL_REQUESTED } from '@release-owl/contracts';
import type { ILogger } from '@release-owl/platform';
import { EmailRequestedConsumer } from '../email-requested.consumer.js';
import type { Notifier } from '../email.service.js';

const noopLogger: ILogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

function fakeNotifier(): Notifier {
  return {
    sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
    sendNotificationEmail: jest.fn().mockResolvedValue(undefined),
  };
}

describe('EmailRequestedConsumer', () => {
  it('sends a confirmation email on a confirmation event', async () => {
    const broker = new InMemoryBroker();
    const notifier = fakeNotifier();
    await new EmailRequestedConsumer(broker, notifier, noopLogger).start();

    await broker.publish(EMAIL_REQUESTED, {
      type: 'confirmation',
      email: 'a@b.com',
      repo: 'owner/repo',
      confirm_token: 'tok',
    });

    expect(notifier.sendConfirmationEmail).toHaveBeenCalledWith(
      'a@b.com',
      'tok',
      'owner/repo',
    );
    expect(notifier.sendNotificationEmail).not.toHaveBeenCalled();
  });

  it('sends a release notification on a notification event', async () => {
    const broker = new InMemoryBroker();
    const notifier = fakeNotifier();
    await new EmailRequestedConsumer(broker, notifier, noopLogger).start();

    await broker.publish(EMAIL_REQUESTED, {
      type: 'notification',
      email: 'a@b.com',
      repo: 'owner/repo',
      tag_name: 'v1',
      unsubscribe_token: 'tok',
    });

    expect(notifier.sendNotificationEmail).toHaveBeenCalledWith(
      'a@b.com',
      'owner/repo',
      'v1',
      'tok',
    );
  });
});
