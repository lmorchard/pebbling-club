import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema
    .createTable("Feeds", (t) => {
      commonFields(t);
      t.boolean("disabled");
      t.string("url").index().unique();
      t.string("title");
      t.string("link");
      t.timestamp("newestItemDate");
    })
    .createTable("FeedItems", (t) => {
      commonFields(t);
      t.string("feedId").references("Feeds.id");
      t.string("guid").index().unique();
      t.string("date");
      t.string("link");
      t.string("title");
      t.string("summary");
      t.string("description");
      t.timestamp("lastSeenAt");
      t.timestamp("firstSeenAt");
    });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable("Feeds").dropTable("FeedItems");
}

const commonFields = (t: Knex.CreateTableBuilder) => {
  t.increments("id").primary();
  t.timestamps(true, true, true);
  t.json("metadata");
};
