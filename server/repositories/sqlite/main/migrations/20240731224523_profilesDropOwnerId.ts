import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable("profiles", (table) => {
    table.dropColumn("ownerId");
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable("profiles", (table) => {
    table.string("ownerId");
  });
}
