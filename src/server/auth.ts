import { Express } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Server } from "./index";

declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
    }
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
  /*
  // TODO: rework this stuff not to hit the DB?
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

  app.use(passport.authenticate("session"));

  app.use(function (req, res, next) {
    res.locals.globalProps.user = req.user;
    next();
  });
}
