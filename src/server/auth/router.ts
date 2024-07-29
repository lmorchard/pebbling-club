import { Server } from "../index";
import { Router, Express } from "express";
import passport, { AuthenticateCallback } from "passport";
import { matchedData, body, validationResult } from "express-validator";
import templateSignup from "./templates/signup";
import templateLogin from "./templates/login";

export default function init(server: Server, app: Express) {
  const router = Router();

  router.get("/", (req, res) => {
    const { layoutProps } = res.locals;

    res.send("Hello AUTH!");
  });

  router.get("/signup", function (req, res, next) {
    const { layoutProps } = res.locals;
    res.send(templateSignup({ ...layoutProps })());
  });

  router.get("/login", function (req, res, next) {
    const { layoutProps } = res.locals;
    res.send(templateLogin({ ...layoutProps })());
  });

  router.post(
    "/login",
    /*
    function (req, res, next) {
      const { layoutProps } = res.locals;
      const authenticateCallback: AuthenticateCallback = (
        err,
        user,
        info,
        status
      ) => {
        if (err) return next(err);
        if (!user) {
          return res.send(templates.login({ info, ...layoutProps })());
        }
        res.redirect("/");
      };

      passport.authenticate("local", authenticateCallback)(req, res, next);
    }
    */
    passport.authenticate("local", {
      failureRedirect: "/auth/login",
      failureMessage: true,
    }),
    function(req, res) {
      res.redirect('/');
    }   
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

    // TODO: add repeat password and validation

    passwords
      .create(username, password)
      .then((id: string) => {
        const user = { id, username };
        req.login(user, function (err) {
          if (err) return next(err);
          res.redirect("/");
        });
      })
      .catch((err) => next(err));
  });

  return router;
}
