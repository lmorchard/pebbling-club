import { Server } from "../index";
import { Router, Express } from "express";
import passport, { AuthenticateCallback } from "passport";
import { matchedData, body, validationResult } from "express-validator";
import templateSignup from "./templates/signup";
import templateLogin from "./templates/login";

export default function init(server: Server, app: Express) {
  const router = Router();

  router.get("/", (req, res) => {
    res.send("Hello AUTH!");
  });

  router.get("/signup", function (req, res, next) {
    res.send(templateSignup(res.locals)());
  });

  router.get("/login", function (req, res, next) {
    res.send(templateLogin(res.locals)());
  });

  router.post(
    "/login",
    body("username").trim().isString().notEmpty(),
    body("password").trim().isString().notEmpty(),
    function (req, res, next) {
      const validation = validationResult(req);
      if (validation.isEmpty()) return next();

      return res.send("NOPE NOPE NOPE");
    },
    passport.authenticate("local", {
      failureRedirect: "/auth/login",
      failureMessage: true,
    }),
    function (req, res) {
      res.redirect("/");
    }
  );

  router.post("/logout", function (req, res, next) {
    req.logout(function (err) {
      if (err) return next(err);
      res.redirect("/");
    });
  });

  router.post(
    "/signup",
    body("username").trim().isString().notEmpty(),
    body("password").trim().isString().notEmpty(),
    body("password-confirm")
      .trim()
      .isString()
      .notEmpty()
      .custom((value, { req }) => {
        if (req.body.password !== value) {
          throw new Error("Passwords do not match");
        }
      }),
    function (req, res, next) {
      const validation = validationResult(req);
      if (!validation.isEmpty()) {
        return res.send(`ERR ${JSON.stringify(validation.array())}`);
      }

      const { username, password } = req.body;


      // TODO: add repeat password and validation
      return res.send("OK");
      /*
      const { passwords } = server.app.services;
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
        */
    }
  );

  return router;
}
