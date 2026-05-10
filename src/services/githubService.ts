import { GitHubRateLimitError } from '../errors.js';
import { config } from '../config/index.js';

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

  constructor() {
    this.headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(config.github.token
        ? { Authorization: `Bearer ${config.github.token}` }
        : {}),
    };
  }

  /** Throws GitHubRateLimitError when the response status is 429.
   *  Reads X-RateLimit-Reset header (Unix seconds) to populate resetAt. */
  private handleRateLimit(response: Response): void {
    if (response.status !== 429) return;

    const resetHeader = response.headers.get('X-RateLimit-Reset');
    const resetAt = resetHeader
      ? new Date(Number(resetHeader) * 1000)
      : new Date(Date.now() + 60_000);

    throw new GitHubRateLimitError(resetAt);
  }

  /** Returns true if the repository exists on GitHub (status 200), false on 404.
   *  Throws GitHubRateLimitError on 429, generic Error on any other unexpected status. */
  async repositoryExists(repo: string): Promise<boolean> {
    const response = await fetch(`${GITHUB_API}/repos/${repo}`, {
      method: 'GET',
      headers: this.headers,
    });

    if (response.status === 200) return true;
    if (response.status === 404) return false;

    this.handleRateLimit(response);

    throw new Error(
      `GitHub API returned unexpected status ${response.status} for repo "${repo}"`,
    );
  }

  /** Returns the latest release tag_name and html_url, or null if no releases exist.
   *  Throws GitHubRateLimitError on 429, generic Error on any other unexpected status. */
  async getLatestRelease(repo: string): Promise<Release | null> {
    const response = await fetch(
      `${GITHUB_API}/repos/${repo}/releases/latest`,
      {
        method: 'GET',
        headers: this.headers,
      },
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
