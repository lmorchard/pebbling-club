import path from "path";
import { mkdirp } from "mkdirp";
import { App } from "../../app/index";
import { BaseKnexRepository } from "../knex";

const connection = async () => {
  // Get an instance of App to access config
  const app = await new App().init();
  if (! (app.repository instanceof BaseKnexRepository)) {
    throw new Error("Invalid repository type");
  }

  // HACK: knex changes working directory, so adjust accordingly
  const { config } = app;
  let dataPath = config.get("dataPath");
  if (!dataPath.startsWith("/")) {
    dataPath = path.join(__dirname, "..", "..", "..", dataPath);
    config.set("dataPath", dataPath);
  }

  // HACK: should this go elsewhere?
  mkdirp.sync(dataPath);

  return app.repository.knexConnectionOptions();
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
