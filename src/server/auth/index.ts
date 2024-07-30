import { Express } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Server } from "../index";

declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
    }
  }
}

export default async function init(server: Server, app: Express) {
  const { passwords } = server.app.services;

  passport.use(
    new LocalStrategy(function verify(username, password, cb) {
      passwords
        .verify(username, password)
        .then((userId) => cb(null, userId ? { id: userId, username } : false))
        .catch((err) => cb(err));
    })
  );

  passport.serializeUser(function (user, cb) {
    process.nextTick(function () {
      cb(null, user);
    });
  });

  passport.deserializeUser(function (id: Express.User, cb) {
    process.nextTick(function () {
      cb(null, id as Express.User);
    });
  });

  /* Configure session management. */
  /*
  // TODO: rework this stuff not to hit the DB? maybe lazy load?
  passport.serializeUser(function (user, cb) {
    process.nextTick(function () {
      cb(null, user.id);
    });
  });

  passport.deserializeUser(function (id: string, cb) {
    const { passwords } = server.app.services;
    passwords.get(id).then(username => {
      if (!username) return cb(null, null);
      return cb(null, { id, username });
    }).catch(err => cb(err, null));
  });
  */

  app.use(passport.authenticate("session"));

  app.use(function (req, res, next) {
    res.locals.user = req.user;
    next();
  });
}
