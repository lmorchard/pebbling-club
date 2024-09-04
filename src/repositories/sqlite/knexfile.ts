import path from "path";
import { mkdirp } from "mkdirp";
import { App } from "../../app/index";

const connection = async () => {
  // Get an instance of App to access config
  const app = await new App().init();

  // HACK: knex changes working directory, so adjust accordingly
  const { config } = app;
  let databasePath = config.get("sqliteDatabasePath");
  if (!databasePath.startsWith("/")) {
    databasePath = path.join(__dirname, "..", "..", "..", databasePath);
    config.set("sqliteDatabasePath", databasePath);
  }

  // HACK: should this go elsewhere?
  mkdirp.sync(databasePath);

  // HACK: need a better way to express this in types
  const repository = app.repository;

  return repository.knexConnectionOptions();
};

// HACK: squelch a buggy warning from sqlite3 dialect - it seems to check
// for a .filename, not accounting for async function as option
// https://github.com/knex/knex/blob/176151d8048b2a7feeb89a3d649a5580786d4f4e/lib/dialects/sqlite3/index.js#L24
connection.filename = "noop";

export default {
  client: "sqlite3",
  useNullAsDefault: true,
  connection,
};
