import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable("bookmarks", (table) => {
    table.unique(["ownerId", "href"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable("bookmarks", (table) => {
    table.dropUnique(["ownerId", "href"]);
  });
}
