import type { IBroker } from './broker.interface.js';

type AnyHandler = (payload: unknown) => Promise<void>;

export class InMemoryBroker implements IBroker {
  private readonly handlers = new Map<string, AnyHandler[]>();

  async connect(): Promise<void> {}
  async close(): Promise<void> {}

  async publish<T>(routingKey: string, payload: T): Promise<void> {
    const list = this.handlers.get(routingKey) ?? [];
    await Promise.all(
      list.map(async (h): Promise<void> => {
        await h(payload);
      }),
    );
  }

  async subscribe<T>(
    _queue: string,
    routingKey: string,
    handler: (payload: T) => Promise<void>,
  ): Promise<void> {
    await Promise.resolve();
    const list = this.handlers.get(routingKey) ?? [];
    list.push(handler as AnyHandler);
    this.handlers.set(routingKey, list);
  }
}
