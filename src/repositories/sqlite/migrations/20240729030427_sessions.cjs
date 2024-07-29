exports.up = function (knex) {
  return knex.schema.createTable("sessions", function (table) {
    table.string("id").primary();
    table.timestamp("modified");
    table.text("session");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("sessions");
};
