import { Cli } from "./app/cli";
import Server from "./server";
import CliIndex from "./cli";

async function main() {
  const cli = new Cli();

  const { app } = cli;
  app.registerModule("server", Server);
  app.registerModule("cliIndex", CliIndex);

  await cli.init();
  return cli.run();
}

main().catch(console.error);