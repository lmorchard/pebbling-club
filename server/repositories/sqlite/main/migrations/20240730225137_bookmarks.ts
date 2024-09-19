import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("bookmarks", (table) => {
    table.string("id").primary();
    table.string("ownerId");
    table.string("href");
    table.string("title");
    table.string("extended");
    table.string("tags");
    table.string("visibility");
    table.json("meta");
    table.timestamp("created");
    table.timestamp("modified");
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists("bookmarks");
}

