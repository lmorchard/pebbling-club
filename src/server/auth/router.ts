import { Server } from "../index";
import { Router, Express } from "express";
import passport from "passport";
import { body } from "express-validator";
import templateSignup from "./templates/signup";
import templateLogin from "./templates/login";
import { withValidation, ifNotValid } from "../common/forms";
import { renderWithLocals } from "../common/templates";

export default function init(server: Server, app: Express) {
  const { services } = server.app;
  const router = Router();

  router.get("/", (req, res) => {
    // TODO: redirect to profile?
    res.send("Hello AUTH!");
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
      // failureFlash: "Username or password incorrect",
      failureRedirect: "/auth/login",
      successRedirect: "/",
    }),
    //renderWithLocals(templateLogin),
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
    function (req, res, next) {
      const { username, password } = res.locals.formData!;
      services.passwords
        .create(username, password)
        .then((id: string) => {
          const user = { id, username };
          req.login(user, function (err) {
            if (err) return next(err);
            res.redirect("/");
          });
        })
        .catch((err) => next(err));
    }
  );

  return router;
}
