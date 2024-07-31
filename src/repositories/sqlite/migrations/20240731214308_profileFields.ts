import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable("profiles", (table) => {
    table.string("bio");
    table.string("avatar");
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable("profiles", (table) => {
    table.dropColumn("bio");
    table.dropColumn("avatar");
  });
}
