import Server from "..";
import { Router, Express } from "express";
import asyncHandler from "express-async-handler";
import Boom from "@hapi/boom";
import { render } from "../utils/html";
import templateProfileIndex from "../templates/profile/index";
import { totalmem } from "os";

export default function init(server: Server, app: Express) {
  const { log } = server;
  const { services } = server.app;
  const router = Router();

  router.get("/", (req, res, next) => {
    res.redirect("/");
  });

  router.get(
    "/:username",
    asyncHandler(async (req, res, next) => {
      const { profiles, bookmarks } = services;

      const { username } = req.params;
      const limit = parseInt((req.query.limit as string) || "10", 10);
      const offset = parseInt((req.query.offset as string) || "0", 10);

      const profile = await profiles.getByUsername(username);
      if (!profile?.id) throw Boom.notFound(`profile ${username} not found`);
      res.locals.profile = profile;

      const { total: bookmarksTotal, items: bookmarksItems } =
        await bookmarks.listForOwner(profile.id, limit, offset);

      const pages = [];
      for (let pageOffset = 0; pageOffset < bookmarksTotal; pageOffset += limit) {
        pages.push({ offset: pageOffset });
      }

      res.send(
        render(
          templateProfileIndex({
            ...res.locals,
            profile,
            bookmarks: bookmarksItems,
            pages,
            limit,
            total: bookmarksTotal,
          })
        )
      );
    })
  );

  return router;
}
