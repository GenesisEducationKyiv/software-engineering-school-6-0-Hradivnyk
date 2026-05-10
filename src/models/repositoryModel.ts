import knex from '../db/knex.js';

export interface IRepositoryModel {
  upsert(repo: string): Promise<void>;
  updateLastSeenTag(repo: string, tag: string): Promise<void>;
}

export class RepositoryModel implements IRepositoryModel {
  async upsert(repo: string): Promise<void> {
    await knex('repositories').insert({ repo }).onConflict('repo').ignore();
  }

  async updateLastSeenTag(repo: string, tag: string): Promise<void> {
    await knex('repositories').where({ repo }).update({ last_seen_tag: tag });
  }
}

export const repositoryModel = new RepositoryModel();
