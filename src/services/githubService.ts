import { GitHubRateLimitError } from '../errors.js';
import type { IHttpClient } from '../httpClient.js';

const GITHUB_API = 'https://api.github.com';

export interface Release {
  tag_name: string;
  html_url: string;
}

export interface IGithubService {
  repositoryExists(repo: string): Promise<boolean>;
  getLatestRelease(repo: string): Promise<Release | null>;
}

export class GithubService implements IGithubService {
  private readonly headers: HeadersInit;

  constructor(
    private readonly httpClient: IHttpClient,
    token?: string,
  ) {
    this.headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  /** Throws GitHubRateLimitError when the response status is 403 or 429.
   *  Both status codes can indicate either a primary or secondary rate limit.
   *  Priority for determining resetAt (per GitHub docs):
   *  1. Retry-After header (seconds) — present on secondary rate limit responses.
   *  2. X-RateLimit-Reset header (Unix seconds) — present when x-ratelimit-remaining is 0.
   *  3. Fallback: now + 60 seconds. */
  private handleRateLimit(response: Response): void {
    if (response.status !== 429 && response.status !== 403) return;

    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter) {
      throw new GitHubRateLimitError(
        new Date(Date.now() + Number(retryAfter) * 1000),
      );
    }

    const resetHeader = response.headers.get('X-RateLimit-Reset');
    const resetAt = resetHeader
      ? new Date(Number(resetHeader) * 1000)
      : new Date(Date.now() + 60_000);

    throw new GitHubRateLimitError(resetAt);
  }

  /** Returns true if the repository exists on GitHub (status 200), false on 404.
   *  Throws GitHubRateLimitError on 403 or 429 (primary or secondary rate limit),
   *  generic Error on any other unexpected status. */
  async repositoryExists(repo: string): Promise<boolean> {
    const response = await this.httpClient.get(
      `${GITHUB_API}/repos/${repo}`,
      this.headers,
      { timeoutMs: 10_000 },
    );

    if (response.status === 200) return true;
    if (response.status === 404) return false;

    this.handleRateLimit(response);

    throw new Error(
      `GitHub API returned unexpected status ${response.status} for repo "${repo}"`,
    );
  }

  /** Returns the latest release tag_name and html_url, or null if no releases exist.
   *  Throws GitHubRateLimitError on 403 or 429 (primary or secondary rate limit),
   *  generic Error on any other unexpected status. */
  async getLatestRelease(repo: string): Promise<Release | null> {
    const response = await this.httpClient.get(
      `${GITHUB_API}/repos/${repo}/releases/latest`,
      this.headers,
      { timeoutMs: 10_000 },
    );

    if (response.status === 404) return null;
    if (response.status === 200) {
      const data = (await response.json()) as {
        tag_name: string;
        html_url: string;
      };
      return { tag_name: data.tag_name, html_url: data.html_url };
    }

    this.handleRateLimit(response);

    throw new Error(
      `GitHub API returned unexpected status ${response.status} for releases of "${repo}"`,
    );
  }
}
