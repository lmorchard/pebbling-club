import { Feed } from "./types";
import { FeedsService } from ".";
import { JobPayload, JobProgressFn } from "../jobs/types";
import { FeedPollOptions } from "./poll";

export const JOB_UPDATE_FEED = "updateFeed";
export const JOB_UPDATE_ALL_FEEDS = "updateAllFeeds";

export async function initJobs(this: FeedsService) {
  const { jobs } = this.app;
  if (!jobs) return;

  await jobs.registerJobHandler(JOB_UPDATE_FEED, this.handleUpdateFeedJob);
  await jobs.registerJobHandler(
    JOB_UPDATE_ALL_FEEDS,
    this.handleUpdateAllFeedsJob
  );
}

export async function scheduleAllFeedsUpdate(this: FeedsService) {
  const { log } = this;
  const { jobs } = this.app;
  if (!jobs) return;

  log.debug({ msg: "scheduling feeds updates" });
  await jobs.upsertJobSchedule(
    `schedule-periodic-${JOB_UPDATE_ALL_FEEDS}`,
    { pattern: "*/30 * * * *" },
    { name: JOB_UPDATE_ALL_FEEDS, payload: {} }
  );
}

export interface UpdateFeedJobPayload extends JobPayload {
  feed: Feed;
  options: FeedPollOptions;
}

export interface UpdateFeedJobResult {
  feedId?: string;
}

export async function deferFeedUpdate(
  this: FeedsService,
  feed: Feed,
  options: FeedPollOptions = {}
) {
  const { jobs } = this.app;
  if (!jobs) return;

  return jobs.add(
    JOB_UPDATE_FEED,
    { feed, options },
    { deduplication: { id: `${JOB_UPDATE_FEED}:${feed.url}` } }
  );
}

export async function handleUpdateFeedJob(
  this: FeedsService,
  payload: JobPayload,
  progress: JobProgressFn
): Promise<UpdateFeedJobResult> {
  const { feed, options } = payload as UpdateFeedJobPayload;
  const { forceFetch = false, maxage = this.app.config.get("feedPollMaxAge") } =
    options;
  const result = await this.update(feed, { forceFetch, maxage });
  return { feedId: result?.feedId };
}

export async function handleUpdateAllFeedsJob(
  this: FeedsService,
  payload: JobPayload,
  progress: JobProgressFn
) {
  const { app, log } = this;
  const { feedsRepository: repository } = app;

  log.info({ msg: "updating all feeds" });

  const feeds = repository.fetchAllFeeds();
  for await (const streamItem of feeds) {
    const feed = streamItem as unknown as Feed;
    await this.deferFeedUpdate(feed);
  }

  return {};
}
