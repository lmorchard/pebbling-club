exports.up = function(knex) {
  return knex.schema
    .createTable("users", function (table) {
      table.uuid("id");
      table.string("username").unique();
      table.string("hashed_password");
      table.string("salt");
    });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('users');
};
