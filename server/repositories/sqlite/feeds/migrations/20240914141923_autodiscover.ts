import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema
    .createTable("FeedDiscoveries", (t) => {
      t.increments("id").primary();
      t.string("url").index();
      t.string("title");
      t.string("feedUrl");
      t.string("type");
      t.string("rel");
      t.integer("priority");
      t.unique(["url", "feedUrl"]);
      t.timestamps(true, true, true);
    });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable("FeedDiscoveries");
}
