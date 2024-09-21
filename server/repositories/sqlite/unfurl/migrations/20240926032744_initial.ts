import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema
    .createTable("UnfurlCache", (t) => {
      t.increments("id").primary();
      t.string("url").index().unique();
      t.json("metadata");
      t.integer("cachedAt");
    });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable("UnfurlCache");
}
