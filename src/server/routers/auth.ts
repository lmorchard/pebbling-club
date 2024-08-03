import { FastifyPluginAsync } from "fastify";
import FastifyPassport from "@fastify/passport";
import templateLogin from "../templates/auth/login";
import { IBaseRouterOptions } from "./types";

export interface IRouterOptions extends IBaseRouterOptions {}

const Router: FastifyPluginAsync<IRouterOptions> = async (fastify, options) => {
  const { server } = options;

  fastify.get("/login", async (request, reply) => {
    return reply.renderTemplate(templateLogin);
  });

  fastify.post(
    "/login",
    {
      preValidation: FastifyPassport.authenticate("local", {
        failureMessage: "Username or password incorrect",
        failureRedirect: "/auth/login",
        successRedirect: "/",
      }),
    },
    async (request, reply) => {
      return reply.code(200).send("Logged in!");
    }
  );

  fastify.post("/logout", async (request, reply) => {
    request.logOut();
    return reply.redirect("/");
  });
};

export default Router;

/*
export default function init(server: Server, app: Express) {
  const { services } = server.app;
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

  router.get("/signup", renderWithLocals(templateSignup));

  router.post(
    "/signup",
    body("username")
      .trim()
      .isString()
      .notEmpty()
      .custom(async (value) => {
        if (await services.profiles.usernameExists(value))
          throw new Error("Username already exists");
        return true;
      }),
    // TODO: reject some characters from usernames (e.g. URL reserved characters)
    // TODO: move validation into the profiles service?
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
      const id = await services.profiles.create({ username }, { password });
      const user = { id, username };
      req.login(user, function (err) {
        if (err) return next(err);
        res.redirect("/");
      });
    })
  );

  return router;
}
*/
