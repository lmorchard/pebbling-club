#!/usr/bin/env -S npx tsx
import { BaseServerApp } from "../base";

async function main() {
  const app = new BaseServerApp();
  await app.init();

  const { jobs, feeds, webServer } = app;

  const closePromise = await webServer.start();

  await jobs.start();
  await jobs.scheduler.scheduleJobPurge();
  await feeds.scheduleAllFeedsUpdate();

  return closePromise;
}

main().catch(console.error);
