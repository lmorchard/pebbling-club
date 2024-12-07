#!/usr/bin/env -S npx tsx
import { BaseServerApp } from "../base";

async function main() {
  const app = new BaseServerApp();
  await app.init();

  const { config, jobs, feeds, webServer, logging } = app;

  const serverIdleTimeout = config.get("serverIdleTimeout");
  const serverIdleCheckPeriod = config.get("serverIdleCheckPeriod");

  const log = logging.child({ name: "ExitOnIdleNode" });

  const server = await webServer.buildServer();

  const closePromise = new Promise<void>((resolve, reject) => {
    server.addHook("onClose", (instance, done) => {
      resolve();
      done();
    });
  });

  let serverLastIdleTime = Date.now();

  server.addHook("onRequest", async (request, reply) => {
    serverLastIdleTime = Date.now();
    log.debug({
      msg: "Server active",
      activeRequests: webServer.activeRequests,
    });
  });

  setInterval(async () => {
    if (webServer.activeRequests > 0) {
      serverLastIdleTime = Date.now();
      log.debug({
        msg: "Server active",
        activeRequests: webServer.activeRequests,
      });
      return;
    }

    const queueIsIdle = await jobs.isIdle();
    if (!queueIsIdle) {
      serverLastIdleTime = Date.now();
      log.debug({
        msg: "Queue active",
        total: await jobs.queue.totalCount(),
        pending: await jobs.queue.pendingCount(),
        count: await jobs.queue.count(),
      });
      return;
    }

    const serverDuration = Date.now() - serverLastIdleTime;
    log.debug({
      msg: "Checking server idle time",
      TTL: serverIdleTimeout - serverDuration,
    });
    if (serverDuration > serverIdleTimeout) {
      log.debug({ msg: "Server has been idle for too long" });
      await server.close();
    }
  }, serverIdleCheckPeriod);

  await server.listen({
    host: config.get("host"),
    port: config.get("port"),
  });

  await jobs.start();

  await jobs.scheduler.scheduleJobPurge();

  await feeds.scheduleAllFeedsUpdate();

  await closePromise;

  log.debug({ msg: "Server shutting down" });
  await app.deinit();

  log.info({ msg: "Server exiting" });
  process.exit(0);
}

main().catch(console.error);
