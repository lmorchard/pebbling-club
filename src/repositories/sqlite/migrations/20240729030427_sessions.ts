import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable("sessions", function (table) {
    table.string("id").primary();
    table.timestamp("modified");
    table.text("session");
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists("sessions");
}
