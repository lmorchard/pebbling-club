import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("sessions");
  await knex.schema.alterTable("passwords", (table) => {
    table.string("profileId");
  });
  await knex
    .update({
      profileId: knex
        .select("profiles.id")
        .from("profiles")
        .where("profiles.username", knex.raw("passwords.username")),
    })
    .table("passwords");
  await knex.schema.alterTable("passwords", (table) => {
    table
      .foreign("profileId")
      .references("profiles.id")
      .onDelete("CASCADE")
      .onUpdate("CASCADE");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("passwords", (table) => {
    table.dropColumn("profileId");
  });
  await knex.schema.createTable("sessions", function (table) {
    table.string("id").primary();
    table.timestamp("modified");
    table.text("session");
  });
}
