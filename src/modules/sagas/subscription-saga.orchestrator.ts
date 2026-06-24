import type { ILogger } from '@release-owl/platform';
import type { IUnitOfWork } from '../../platform/db/unit-of-work.js';
import type { ISubscriptionModel } from '../subscriptions/subscription.model.js';
import type { ISagaModel } from './subscription-saga.model.js';

/**
 * Handles the two terminal outcomes of the subscribe Saga.
 *
 * Happy path  — email.sent  → markCompleted  (subscription stays pending until
 *               the user clicks the confirmation link, which is outside the saga).
 * Failure path — email.failed → delete the pending subscription + markCompensated
 *               (true undo; frees the (email, repo) unique slot for a re-subscribe).
 *
 * All state transitions run inside a single UoW transaction and are idempotent:
 * if the saga is already terminated the handler is a no-op, so at-least-once
 * message redelivery cannot cause double-compensation.
 */
export class SubscriptionSagaOrchestrator {
  constructor(
    private readonly sagaModel: ISagaModel,
    private readonly subscriptionModel: ISubscriptionModel,
    private readonly uow: IUnitOfWork,
    private readonly logger: ILogger,
  ) {}

  async onEmailSent(sagaId: string): Promise<void> {
    await this.uow.run(async (trx) => {
      const saga = await this.sagaModel.findById(sagaId, trx);
      if (!saga) {
        this.logger.warn(
          { event: 'saga.reply.unknown', sagaId },
          'Received email.sent for unknown saga — ignoring',
        );
        return;
      }
      if (saga.status !== 'started') {
        // Idempotent: already completed or compensated, nothing to do.
        return;
      }
      await this.sagaModel.markCompleted(sagaId, trx);
    });
    this.logger.info(
      { event: 'saga.completed', sagaId },
      'Saga completed: confirmation email delivered',
    );
  }

  async onEmailFailed(sagaId: string, reason: string): Promise<void> {
    let subscriptionId: string | null = null;

    await this.uow.run(async (trx) => {
      const saga = await this.sagaModel.findById(sagaId, trx);
      if (!saga) {
        this.logger.warn(
          { event: 'saga.reply.unknown', sagaId },
          'Received email.failed for unknown saga — ignoring',
        );
        return;
      }
      if (saga.status !== 'started') {
        // Idempotent: already handled.
        return;
      }
      subscriptionId = saga.subscription_id;
      // Compensation: remove the pending subscription so the user can re-subscribe.
      await this.subscriptionModel.deleteById(saga.subscription_id, trx);
      await this.sagaModel.markCompensated(sagaId, trx);
    });

    if (subscriptionId !== null) {
      this.logger.info(
        { event: 'saga.compensated', sagaId, subscriptionId, reason },
        'Saga compensated: pending subscription deleted',
      );
    }
  }
}
