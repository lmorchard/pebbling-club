import Server from "..";
import { Router, Express } from "express";
import asyncHandler from "express-async-handler";
import Boom from "@hapi/boom";
import { render } from "../utils/html";
import templateProfileIndex from "../templates/profile/index";

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
      const { username } = req.params;
      const { profiles, bookmarks } = services;

      const profile = await profiles.getByUsername(username);
      if (!profile?.id) throw Boom.notFound(`profile ${username} not found`);
      res.locals.profile = profile;

      const bookmarkList = await bookmarks.listForOwner(profile.id, 1000);
      log.debug({ msg: "bookmarks", bookmarkList });

      res.send(
        render(
          templateProfileIndex({
            ...res.locals,
            profile,
            bookmarks: bookmarkList,
          })
        )
      );
    })
  );

  return router;
}
