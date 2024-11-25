import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema
    .createTable("JobSchedules", (t) => {
      t.increments("id").primary();
      t.string("key").unique();
      t.json("repeatOptions");
      t.json("jobTemplate");
      t.string("jobId").nullable();
      t.integer("prevMillis").nullable();
      t.integer("nextMillis").nullable();
      t.timestamps(true, true, true);
    });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable("JobSchedules");
}
