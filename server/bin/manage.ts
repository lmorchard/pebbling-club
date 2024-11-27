#!/usr/bin/env -S npx tsx
import { BaseServerCliApp } from "../baseCli";

async function main() {
  const app = new BaseServerCliApp();
  await app.init();
  return app.run();
}

main().catch(console.error);
