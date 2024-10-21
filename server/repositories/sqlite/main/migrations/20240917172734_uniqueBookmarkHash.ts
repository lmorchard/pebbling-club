import type { Knex } from "knex";
import { SqliteRepository } from "..";
import { BaseApp } from "../../../../app";
import { IApp } from "../../../../app/types";
import {
  Bookmark,
  BookmarksService,
  IBookmarksRepository,
} from "../../../../services/bookmarks";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("bookmarks", (table) => {
    table.string("uniqueHash");
  });

  const app = new StubApp(knex);
  const updates: { id: string; uniqueHash: string }[] = [];
  const chunkSize = 100;
  const commit = async () => {
    await knex.transaction(async (trx) => {
      const chunk = updates.splice(0, chunkSize);
      for (const { id, uniqueHash } of chunk) {
        await trx("bookmarks").update({ uniqueHash }).where({ id });
      }
    });
  };

  const rows = knex<Bookmark>("bookmarks").select(["id", "href"]).stream();
  for await (const { id, href } of rows) {
    const uniqueHash = await app.bookmarks.generateUrlHash(href);
    updates.push({ id, uniqueHash });
    if (updates.length >= chunkSize) await commit();
  }
  await commit();

  await knex.raw(`
    DELETE FROM bookmarks
    WHERE rowid NOT IN (
        SELECT MIN(rowid)
        FROM bookmarks
        GROUP BY uniqueHash
    );    
  `);

  return knex.schema.alterTable("bookmarks", (table) => {
    table.dropUnique(["ownerId", "href"]);
    table.unique(["ownerId", "uniqueHash"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("bookmarks", (table) => {
    table.dropUnique(["ownerId", "uniqueHash"]);
    table.unique(["ownerId", "href"]);
  });
  // Avoid table.dropColumn, it destroys triggers - https://github.com/knex/knex/issues/6142
  await knex.schema.raw(`ALTER TABLE bookmarks DROP COLUMN uniqueHash`);
}

class StubApp extends BaseApp implements IApp {
  repository: IBookmarksRepository;
  bookmarks: BookmarksService;

  constructor(connection: Knex<any, unknown[]>) {
    super();
    this.modules.push(
      (this.repository = new StubSqliteRepository(this, connection)),
      (this.bookmarks = new BookmarksService(this))
    );
  }
}

class StubSqliteRepository extends SqliteRepository {
  constructor(app: IApp, connection: Knex<any, unknown[]>) {
    super(app);
    this._connection = connection;
  }
  async init() {}
}
