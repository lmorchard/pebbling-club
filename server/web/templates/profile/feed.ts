import { BookmarkWithPermissions } from "../../../services/bookmarks";
import { Profile } from "../../../services/profiles";
import { Feed } from "feed";

export enum FeedFormats {
  rss = "rss",
  atom = "atom",
  json = "json",
}

export interface Props {
  id?: string;
  copyright?: string;
  format: FeedFormats;
  profile: Profile;
  bookmarks: BookmarkWithPermissions[];
}

export default ({
  id = "Bookmarks",
  copyright = "",
  format,
  profile,
  bookmarks,
}: Props) => {
  const feed = new Feed({
    id,
    copyright,
    title: profile.username,
  });

  for (const bookmark of bookmarks) {
    feed.addItem({
      title: bookmark.title,
      id: bookmark.href,
      link: bookmark.href,
      date: new Date(bookmark.created!),
      description: bookmark.extended,
    });
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
