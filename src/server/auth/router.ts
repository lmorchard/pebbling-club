import Server from "../index";
import { Router, Express } from "express";
import asyncHandler from "express-async-handler";
import passport from "passport";
import { body } from "express-validator";
import templateSignup from "../templates/auth/signup";
import templateLogin from "../templates/auth/login";
import { withValidation, ifNotValid } from "../utils/forms";
import { renderWithLocals } from "../utils/templates";
import { App } from "../../app";

export default function init(server: Server, app: Express) {
  const { services } = server.app as App;
  const router = Router();

  router.get("/", (req, res, next) => {
    // TODO: redirect to profile?
    res.redirect("/");
  });

  router.get("/login", renderWithLocals(templateLogin));

  router.post(
    "/login",
    body("username").trim().isString().notEmpty(),
    body("password").trim().isString().notEmpty(),
    withValidation(),
    ifNotValid(renderWithLocals(templateLogin)),
    passport.authenticate("local", {
      failureMessage: "Username or password incorrect",
      failureRedirect: "/auth/login",
      successRedirect: "/",
    }),
  );

  router.post("/logout", function (req, res, next) {
    req.logout(function (err) {
      if (err) return next(err);
      res.redirect("/");
    });
  });

  router.get("/signup", renderWithLocals(templateSignup));

  router.post(
    "/signup",
    body("username")
      .trim()
      .isString()
      .notEmpty()
      .custom(async (value) => {
        if (await services.passwords.usernameExists(value))
          throw new Error("Username already exists");
        return true;
      }),
    body("password").trim().isString().notEmpty(),
    body("password-confirm")
      .trim()
      .isString()
      .notEmpty()
      .custom((value, { req }) => {
        if (req.body.password !== value)
          throw new Error("Passwords do not match");
        return true;
      }),
    withValidation(),
    ifNotValid(renderWithLocals(templateSignup)),
    asyncHandler(async (req, res, next) => {
      const { username, password } = res.locals.formData!;
      const id = await services.passwords.create(username, password);
      const user = { id, username };
      req.login(user, function (err) {
        if (err) return next(err);
        res.redirect("/");
      });
    })
  );

  return router;
}
