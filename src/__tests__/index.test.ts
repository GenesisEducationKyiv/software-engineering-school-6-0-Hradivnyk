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
  scannerService: { scan: jest.fn() },
}));
jest.mock('../utils/logger.js', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn() },
}));

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

  it('should register a cron job with the configured schedule on a valid cron', async () => {
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

    expect(jest.mocked(cron).schedule).toHaveBeenCalledWith(
      '0 * * * *',
      expect.any(Function),
    );
  });
});
