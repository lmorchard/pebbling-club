import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema
    .createTable("Jobs", (t) => {
      t.increments("id").primary();
      t.integer("priority").nullable();
      t.string("reservation").nullable();
      t.string("name");
      t.string("state");
      t.json("payload");
      t.json("options").nullable();
      t.json("result").nullable();
      t.json("status").nullable();
      t.timestamps(true, true, true);
    });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable("Jobs");
}
