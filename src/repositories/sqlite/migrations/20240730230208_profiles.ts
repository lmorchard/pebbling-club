import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("profiles", (table) => {
    table.string("id").primary();
    table.string("ownerId");
    table.string("displayName");
    table.json("meta");
    table.timestamp("created");
    table.timestamp("modified");
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists("profiles");
}
