import { GitHubRateLimitError } from '../../errors.js';
import { GithubService } from '../githubService.js';

function mockResponse(
  status: number,
  body?: object,
  headers?: Record<string, string>,
): Response {
  return {
    status,
    json: jest.fn().mockResolvedValue(body ?? {}),
    headers: {
      get: (key: string) => headers?.[key] ?? null,
    },
  } as unknown as Response;
}

describe('GithubService', () => {
  let service: GithubService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new GithubService();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('repositoryExists', () => {
    it('should return true if GitHub API responds with 200 for a valid repository', async () => {
      fetchSpy.mockResolvedValue(mockResponse(200));

      const result = await service.repositoryExists('owner/repo');

      expect(result).toBe(true);
    });

    it('should return false if GitHub API responds with 404', async () => {
      fetchSpy.mockResolvedValue(mockResponse(404));

      const result = await service.repositoryExists('owner/nonexistent');

      expect(result).toBe(false);
    });

    it('should throw GitHubRateLimitError on 429 and parse the X-RateLimit-Reset header', async () => {
      const resetUnix = Math.floor(Date.now() / 1000) + 3600;
      fetchSpy.mockResolvedValue(
        mockResponse(429, {}, { 'X-RateLimit-Reset': String(resetUnix) }),
      );

      await expect(service.repositoryExists('owner/repo')).rejects.toThrow(
        GitHubRateLimitError,
      );
    });

    it('should throw GitHubRateLimitError with a fallback resetAt when the header is missing', async () => {
      fetchSpy.mockResolvedValue(mockResponse(429));

      await expect(service.repositoryExists('owner/repo')).rejects.toThrow(
        GitHubRateLimitError,
      );
    });

    it('should throw an error if GitHub API returns an unexpected status code', async () => {
      fetchSpy.mockResolvedValue(mockResponse(500));

      await expect(service.repositoryExists('owner/repo')).rejects.toThrow(
        /unexpected status 500/,
      );
    });

    it('should throw an error if the network request fails', async () => {
      fetchSpy.mockRejectedValue(new Error('Network error'));

      await expect(service.repositoryExists('owner/repo')).rejects.toThrow(
        'Network error',
      );
    });
  });

  describe('getLatestRelease', () => {
    it('should return the latest release tag for a repository', async () => {
      fetchSpy.mockResolvedValue(
        mockResponse(200, {
          tag_name: 'v1.2.3',
          html_url: 'https://github.com/owner/repo/releases/tag/v1.2.3',
        }),
      );

      const release = await service.getLatestRelease('owner/repo');

      expect(release).toEqual({
        tag_name: 'v1.2.3',
        html_url: 'https://github.com/owner/repo/releases/tag/v1.2.3',
      });
    });

    it('should return null if the repository has no releases', async () => {
      fetchSpy.mockResolvedValue(mockResponse(404));

      const release = await service.getLatestRelease('owner/repo');

      expect(release).toBeNull();
    });

    it('should throw GitHubRateLimitError if GitHub API returns 429', async () => {
      const resetUnix = Math.floor(Date.now() / 1000) + 3600;
      fetchSpy.mockResolvedValue(
        mockResponse(429, {}, { 'X-RateLimit-Reset': String(resetUnix) }),
      );

      await expect(service.getLatestRelease('owner/repo')).rejects.toThrow(
        GitHubRateLimitError,
      );
    });

    it('should throw an error if GitHub API returns an unexpected status code', async () => {
      fetchSpy.mockResolvedValue(mockResponse(503));

      await expect(service.getLatestRelease('owner/repo')).rejects.toThrow(
        /unexpected status 503/,
      );
    });

    it('should throw an error if the network request fails', async () => {
      fetchSpy.mockRejectedValue(new Error('Connection refused'));

      await expect(service.getLatestRelease('owner/repo')).rejects.toThrow(
        'Connection refused',
      );
    });
  });
});
