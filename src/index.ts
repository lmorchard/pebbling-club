import { MainCliApp } from "./cli";

async function main() {
  const app = new MainCliApp();
  await app.init();
  return app.run();
}

main().catch(console.error);