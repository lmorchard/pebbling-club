import { Cli } from "./cli";

async function main() {
  const cli = await new Cli().init();
  return cli.run();
}

main().catch(console.error);