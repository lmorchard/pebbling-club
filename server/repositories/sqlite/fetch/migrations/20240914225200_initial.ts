import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema
    .createTable("FetchCache", (t) => {
      t.increments("id").primary();
      t.string("url").index().unique();
      t.json("headers");
      t.integer("status");
      t.string("statusText");
      t.binary("body");
      t.integer("cachedAt");
    });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable("FetchCache");
}
