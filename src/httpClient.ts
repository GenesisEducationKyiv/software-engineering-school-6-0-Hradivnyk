export interface IHttpClient {
  get(url: string, headers: HeadersInit): Promise<Response>;
}

export class FetchHttpClient implements IHttpClient {
  async get(url: string, headers: HeadersInit): Promise<Response> {
    return fetch(url, { method: 'GET', headers });
  }
}
