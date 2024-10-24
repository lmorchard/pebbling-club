import { FeedsService } from ".";
import { FeedPollOptions } from "./poll";
import { parseSince } from "../../utils/since";

export async function get(
  this: FeedsService,
  url: string,
  options: FeedPollOptions & {
    limit?: number;
    offset?: number;
    since?: string;
  } = {}
) {
  const { limit = 50, offset = 0, since } = options;

  const feed = await this.app.feedsRepository.fetchFeedByUrl(url);
  if (!feed) return null;

  const items = await this.app.feedsRepository.fetchItemsForFeed(feed?.id, {
    limit,
    offset,
    since: parseSince(since),
  });

  return { feed, items };
}
