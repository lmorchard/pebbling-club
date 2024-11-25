import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("Jobs", (t) => {
    t.string("deduplicationId");
  });

  await knex.schema.alterTable("Jobs", (t) => {
    t.unique(["deduplicationId"], {
      indexName: "unique_deduplication_id_columns",
    });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("Jobs", (t) => {
    t.dropUnique(["deduplicationId"], "unique_deduplication_id_columns");
  });
  await knex.schema.alterTable("Jobs", (t) => {
    t.dropColumn("deduplicationId");
  });
}
