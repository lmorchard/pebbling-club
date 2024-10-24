import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema
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

export async function down(knex: Knex): Promise<void> {
  return (
    knex.schema
      //.alterTable("bookmarks", function (table) {
      //  table.dropIndex(["id", "feedUrl"]);
      //})
      // Avoid table.dropColumn, it destroys triggers - https://github.com/knex/knex/issues/6142
      .raw(`ALTER TABLE bookmarks DROP COLUMN feedUrl`)
  );
}
