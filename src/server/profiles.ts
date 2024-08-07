import Boom from "@hapi/boom";
import templateProfileIndex from "./templates/profile/index";
import { IBaseRouterOptions } from "./types";
import { FastifyPluginAsync } from "fastify";

export interface IProfilesRouterOptions extends IBaseRouterOptions {}

export const ProfilesRouter: FastifyPluginAsync<
  IProfilesRouterOptions
> = async (fastify, options) => {
  fastify.get<{
    Params: { username: string };
    Querystring: { limit?: string; offset?: string };
  }>("/:username", async (request, reply) => {
    const { app } = options.server;
    const { profiles, bookmarks } = app.services;

    const { username } = request.params;
    const limit = parseInt((request.query.limit as string) || "50", 10);
    const offset = parseInt((request.query.offset as string) || "0", 10);

    const profile = await profiles.getByUsername(username);
    if (!profile?.id) throw Boom.notFound(`profile ${username} not found`);

    const { total: bookmarksTotal, items: bookmarksItems } =
      await bookmarks.listForOwner(profile.id, limit, offset);

    return reply.renderTemplate(templateProfileIndex, {
      profile,
      bookmarks: bookmarksItems,
      limit,
      offset,
      total: bookmarksTotal,
    });
  });
};
