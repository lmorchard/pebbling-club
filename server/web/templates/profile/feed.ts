import { FeedFormats } from "../../types";
import { BookmarkWithPermissions } from "../../../services/bookmarks";
import { Profile } from "../../../services/profiles";
import { Feed, FeedOptions, ItemOptions } from "@gaphub/feed";

export interface Props extends FeedOptions {
  format: FeedFormats;
  title: string;
  bookmarks: BookmarkWithPermissions[];
}

export default ({ format, bookmarks, ...feedOptions }: Props) => {
  const feed = new Feed({
    ...feedOptions,
  });

  for (const bookmark of bookmarks) {
    const item: ItemOptions = {
      title: bookmark.title,
      id: bookmark.href,
      link: bookmark.href,
      date: new Date(bookmark.created!),
    };

    if (bookmark.extended) {
      item.description = bookmark.extended;
    }

    const image = bookmark.meta?.unfurl?.image;
    if (image) {
      item.image = image;
    }

    feed.addItem(item);
  }

  switch (format) {
    case FeedFormats.atom:
      return feed.atom1();
    case FeedFormats.json:
      return feed.json1();
    case FeedFormats.rss:
    default:
      return feed.rss2();
  }
};

export function constructFeedTitle(
  siteName: string,
  username: string,
  tags: string | undefined
) {
  return `${
    tags
      ? `${username}'s bookmarks tagged with ${tags}`
      : `${username}'s bookmarks`
  } on ${siteName}`;
}

export function constructFeedUrl(
  siteUrl: string,
  username: string,
  tags: string | undefined,
  format: FeedFormats
) {
  return new URL(
    // TODO: need some reverse routing utils to generate these URLs
    tags
      ? `/u/${username}/t/${tags}/feed.${FeedFormats[format]}`
      : `/u/${username}/feed.${FeedFormats[format]}`,
    siteUrl
  ).toString();
}
