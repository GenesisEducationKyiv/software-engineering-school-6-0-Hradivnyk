jest.mock('node-cron', () => ({
  __esModule: true,
  default: {
    validate: jest.fn(),
    schedule: jest.fn(),
  },
}));
jest.mock('dotenv/config', () => ({}));
jest.mock('../app.js', () => ({
  __esModule: true,
  default: { listen: jest.fn() },
}));
jest.mock('../container.js', () => ({
  scannerService: { scan: jest.fn(), start: jest.fn() },
  broker: {
    connect: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  },
  outboxRelay: { start: jest.fn(), stop: jest.fn() },
  sagaReplyConsumer: { start: jest.fn().mockResolvedValue(undefined) },
  sagaSweeper: { start: jest.fn(), stop: jest.fn() },
}));
jest.mock('../platform/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn() },
}));
jest.mock('../platform/config/index.js', () => ({
  config: {
    server: { port: 3000 },
    scanner: { cronSchedule: '30 6 * * *' },
  },
}));

const flushAsync = async (): Promise<void> => {
  await new Promise((resolve) => setImmediate(resolve));
};

describe('index startup', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should throw on an invalid cron schedule', async () => {
    const { default: cron } = await import('node-cron');
    jest.mocked(cron).validate.mockReturnValue(false);

    await expect(import('../index.js')).rejects.toThrow(
      /Invalid cron schedule/,
    );
  });

  it('should call scannerService.start() on a valid cron schedule', async () => {
    const { default: cron } = await import('node-cron');
    jest.mocked(cron).validate.mockReturnValue(true);

    const { default: app } = await import('../app.js');
    jest.mocked(app).listen.mockImplementation(((
      _port: unknown,
      cb: () => void,
    ) => {
      cb();
    }) as typeof app.listen);

    await import('../index.js');
    // broker.connect() is awaited before app.listen(), so let the
    // microtask/macrotask queue drain before asserting.
    await flushAsync();

    const { scannerService } = await import('../container.js');
    expect(jest.mocked(scannerService.start)).toHaveBeenCalled();
  });
});
