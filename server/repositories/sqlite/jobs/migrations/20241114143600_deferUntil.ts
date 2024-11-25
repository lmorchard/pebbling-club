import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("Jobs", (t) => {
    t.integer("deferUntil");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("Jobs", (t) => {
    t.dropColumn("deferUntil");
  });
}
