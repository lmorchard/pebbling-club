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
      table.index(["id", "feedUrl"], "bookmarks_feedUrl_index");
    });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable("bookmarks", function (table) {
    table.dropColumn("feedUrl");
    table.dropIndex("feedUrl");
  });
}
