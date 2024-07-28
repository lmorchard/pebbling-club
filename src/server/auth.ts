import crypto from "crypto";
import { Router, Express } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Server } from "./index";
import * as templates from "./templates";

declare namespace Express {
  interface User {
    id: string;
    username: string;
  }
}

export default async function init(server: Server, app: Express) {
  passport.use(
    new LocalStrategy(function verify(username, password, cb) {
      const { passwords } = server.app.services;

      passwords
        .verify(username, password)
        .then((userId) => {
          if (userId) {
            cb(null, { id: userId, username });
          } else {
            cb(null, false);
          }
        })
        .catch((err) => {
          return cb(err);
        });
    })
  );

  /* Configure session management. */
  passport.serializeUser(function (user, cb) {
    process.nextTick(function () {
      // @ts-ignore
      cb(null, { id: user.id, username: user.username });
    });
  });

  passport.deserializeUser(function (user: Express.User, cb) {
    process.nextTick(function () {
      return cb(null, user);
    });
  });

  const router = Router();

  router.get("/", (req, res) => {
    const { globalProps } = res.locals;

    res.send("Hello AUTH!");
  });

  router.get("/signup", function (req, res, next) {
    const { globalProps } = res.locals;
    res.send(templates.signup({ ...globalProps })());
  });

  router.get("/login", function (req, res, next) {
    const { globalProps } = res.locals;
    res.send(templates.login({ ...globalProps })());
  });

  router.post(
    "/login/password",
    passport.authenticate("local", {
      successReturnToOrRedirect: "/",
      failureRedirect: "/auth/login",
      failureMessage: true,
    })
  );

  router.post("/logout", function (req, res, next) {
    req.logout(function (err) {
      if (err) return next(err);
      res.redirect("/");
    });
  });

  router.post("/signup", function (req, res, next) {
    const { passwords } = server.app.services;
    const { username, password } = req.body;

    passwords
      .create(username, password)
      .then((id: string) => {
        var user = {
          id,
          username,
        };
        req.login(user, function (err) {
          if (err) return next(err);
          res.redirect("/");
        });
      })
      .catch((err) => {
        return next(err);
      });
  });

  app.use(passport.authenticate("session"));
  app.use("/auth", router);
}
