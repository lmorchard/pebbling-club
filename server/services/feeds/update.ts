import PQueue from "p-queue";
import { FeedsService } from ".";
import { FeedPollOptions } from "./poll";
import { Feed, FeedExisting } from "./types";

export async function update(
  this: FeedsService,
  feedIn: Feed,
  options: FeedPollOptions = {}
) {
  const { app } = this;
  const { config, feedsRepository: repository } = app;
  const log = this.log.child({ id: feedIn.id, url: feedIn.url });

  log.trace({ msg: "updateFeed", feed: feedIn, options });

  const { forceFetch = false, maxage = config.get("feedPollMaxAge") } = options;

  let feed: Feed | FeedExisting | null = !!feedIn.id
    ? await repository.fetchFeed(feedIn.id)
    : await repository.fetchFeedByUrl(feedIn.url);
  if (!feed) {
    feed = { ...feedIn };
    log.trace({ msg: "fetching new feed", feed });
  } else {
    log.trace({ msg: "fetched feed for update", feed });
  }

  if (!forceFetch && feed.disabled) {
    log.info({ msg: "Feed disabled, skipping update" });
    return;
  }

  if (!forceFetch && feed.metadata?.lastFetched) {
    const age = Date.now() - feed.metadata.lastFetched;
    log.trace({ msg: "checking feed freshness", age, maxage });
    if (age < maxage) {
      log.debug({
        msg: "feed still fresh, skipping update",
        age,
        maxage,
      });
      return;
    }
  }

  const result = await this.poll(feed, options);
  if (!result) return;

  const { feed: feedUpdates, items } = result;
  const feedId = await repository.upsertFeed(feedUpdates);
  const itemIds = await repository.upsertFeedItemBatch(
    {
      id: feedId,
      ...feedUpdates,
    },
    items
  );
  await repository.updateFeedNewestItemDate(feedId);
  return { feed: feedUpdates, items, feedId, itemIds };
}

export async function updateAll(
  this: FeedsService,
  options: FeedPollOptions = {}
) {
  const { app, log } = this;
  const { config, feedsRepository: repository } = app;
  const { forceFetch = false, maxage = config.get("feedPollMaxAge") } = options;

  const concurrency = config.get("feedUpdateAllConcurrency");
  const updateQueue = new PQueue({ concurrency });

  const feeds = repository.fetchAllFeeds();
  for await (const streamItem of feeds) {
    // TODO: figure out a better way to type this stream
    const feed = streamItem as unknown as Feed;
    updateQueue.add(async () => {
      try {
        await this.update(feed, { forceFetch, maxage });
      } catch (err) {
        log.error({ msg: "Error updating feed", feed, err });
      }
    });
    await updateQueue.onSizeLessThan(concurrency);
  }
  await updateQueue.onIdle();
}

export async function updateAllWithJobQueue(
  this: FeedsService,
  options: FeedPollOptions = {}
) {
  const { app, log } = this;
  const { jobs, config, feedsRepository: repository } = app;
  const { forceFetch = false, maxage = config.get("feedPollMaxAge") } = options;

  if (!jobs) return;

  await jobs.queue.start();

  const feeds = repository.fetchAllFeeds();
  for await (const streamItem of feeds) {
    const feed = streamItem as unknown as Feed;
    await this.deferFeedUpdate(feed, { forceFetch, maxage });
  }

  const statusTimer = setInterval(async () => {
    const count = await jobs.manager.pendingCount();
    log.debug({ msg: "job status", count });
  }, 1000);

  await jobs.queue.onIdle();

  clearInterval(statusTimer);
}
