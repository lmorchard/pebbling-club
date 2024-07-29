import { Cli } from "./app/cli";

async function main() {
  const cli = new Cli();
  await cli.init();
  return cli.run();
}

main().catch(console.error);