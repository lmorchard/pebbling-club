import Boom from "@hapi/boom";
import templateProfileIndex from "./templates/profile/index";
import { IBaseRouterOptions } from "./types";
import { FastifyPluginAsync } from "fastify";
import { Profile } from "../services/profiles";
import { TagCount } from "../services/bookmarks";

declare module "fastify" {
  export interface FastifyRequest {
    profile?: Profile;
    tagCounts?: TagCount[];
  }
}

export interface IProfilesRouterOptions extends IBaseRouterOptions {}

export const ProfilesRouter: FastifyPluginAsync<
  IProfilesRouterOptions
> = async (fastify, options) => {
  type BookmarkListOptions = {
    limit?: string;
    offset?: string;
    show?: string;
    open?: string;
  };

  function parseBookmarkListOptions(query: BookmarkListOptions) {
    const limit = parseInt((query.limit as string) || "50", 10);
    const offset = parseInt((query.offset as string) || "0", 10);
    const show = query.show ? query.show.split(",") : undefined;
    const open = query.open ? query.open : undefined;
    return { limit, offset, show, open };
  }

  fastify.decorateRequest("profile", null);

  fastify.addHook<{
    Params: { username: string };
  }>("preHandler", async (request, reply) => {
    const { profiles, bookmarks } = options.server.app;
    const { username } = request.params;

    const profile = await profiles.getByUsername(username);
    if (!profile?.id) throw Boom.notFound(`profile ${username} not found`);

    request.profile = profile;
    // TODO: limit for tags list?
    request.tagCounts = await bookmarks.listTagsForOwner(profile.id, 25, 0);
  });

  fastify.get<{
    Params: { username: string };
    Querystring: BookmarkListOptions;
  }>("/:username", async (request, reply) => {
    const { bookmarks } = options.server.app;
    const { limit, offset, show, open } = parseBookmarkListOptions(request.query);
    const viewerId = request.user?.id;

    const profile = request.profile as Profile;

    const { total: bookmarksTotal, items: bookmarksItems } =
      await bookmarks.listForOwner(viewerId, profile.id, limit, offset);

    return reply.renderTemplate(templateProfileIndex, {
      profile,
      limit,
      offset,
      showAttachments: show,
      openAttachment: open,
      tagCounts: request.tagCounts!,
      total: bookmarksTotal,
      bookmarks: bookmarksItems,
    });
  });

  fastify.get<{
    Params: { username: string; tags: string };
    Querystring: BookmarkListOptions;
  }>("/:username/t/:tags", async (request, reply) => {
    const { bookmarks } = options.server.app;
    const { tags } = request.params;
    const { limit, offset, show, open } = parseBookmarkListOptions(request.query);
    const viewerId = request.user?.id;

    const profile = request.profile as Profile;

    const { total: bookmarksTotal, items: bookmarksItems } =
      await bookmarks.listForOwnerByTags(
        viewerId,
        profile.id,
        tags.split(/[\+ ]+/g),
        limit,
        offset
      );

    // TODO: use a different template? allow per-user annotation / description of tag
    return reply.renderTemplate(templateProfileIndex, {
      profile,
      limit,
      offset,
      showAttachments: show,
      openAttachment: open,
      tagCounts: request.tagCounts!,
      total: bookmarksTotal,
      bookmarks: bookmarksItems,
    });
  });
};
