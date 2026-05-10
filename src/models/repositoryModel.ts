import knex from '../db/knex.js';

export class RepositoryModel {
  async upsert(repo: string): Promise<void> {
    await knex('repositories').insert({ repo }).onConflict('repo').ignore();
  }

  async updateLastSeenTag(repo: string, tag: string): Promise<void> {
    await knex('repositories').where({ repo }).update({ last_seen_tag: tag });
  }
}

export const repositoryModel = new RepositoryModel();
