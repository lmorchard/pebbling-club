import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema.renameTable("users", "passwords");
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.renameTable("passwords", "users");
}
