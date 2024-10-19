import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .alterTable("bookmarks", function (table) {
      table.dropIndex(["id", "feedUrl"]);
    })
    .raw(`ALTER TABLE bookmarks DROP COLUMN feedUrl`);
  await knex.schema
    .raw(
      `--sql
        ALTER TABLE bookmarks ADD COLUMN
          feedUrl TEXT GENERATED ALWAYS AS 
          (coalesce(
            json_extract(meta, "$.unfurl.feed"),
            json_extract(meta, "$.opml.xmlUrl")
          )) VIRTUAL
      `
    )
    .alterTable("bookmarks", function (table) {
      table.index(["id", "feedUrl"]);
    });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .alterTable("bookmarks", function (table) {
      table.dropIndex(["id", "feedUrl"]);
    })
    .raw(`ALTER TABLE bookmarks DROP COLUMN feedUrl`);
  await knex.schema
    .raw(
      `--sql
      ALTER TABLE bookmarks ADD COLUMN
        feedUrl TEXT GENERATED ALWAYS AS (json_extract(meta, "$.unfurl.feed")) VIRTUAL
    `
    )
    .alterTable("bookmarks", function (table) {
      table.index(["id", "feedUrl"]);
    });
}
