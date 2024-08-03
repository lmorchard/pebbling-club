import { FastifyPluginAsync } from "fastify";
import FastifyPassport from "@fastify/passport";
import { IBaseRouterOptions } from "./types";
import templateLogin from "../templates/auth/login";
import templateSignup from "../templates/auth/signup";
import validator from "validator";
import {
  FormErrors,
  invalidMessage,
  validateFormData,
  validatorNot,
} from "../utils/forms";

export interface IRouterOptions extends IBaseRouterOptions {}

const Router: FastifyPluginAsync<IRouterOptions> = async (fastify, options) => {
  const { server } = options;
  const { log, app } = server;
  const { services } = app;
  const { passwords } = services;

  fastify.get("/login", async (request, reply) => {
    return reply.renderTemplate(templateLogin);
  });

  fastify.post<{
    Body: {
      username?: string;
      password?: string;
    };
  }>(
    "/login",
    {
      preValidation: FastifyPassport.authenticate("local", {
        successRedirect: "/",
      }),
    },
    async (request, reply) => {
      return reply.code(200).send("SUBMITTED");
    }
  );

  fastify.post("/logout", async (request, reply) => {
    request.logOut();
    return reply.redirect("/");
  });

  fastify.get("/signup", async (request, reply) => {
    return reply.renderTemplate(templateSignup);
  });

  fastify.post<{
    Body: {
      username?: string;
      password?: string;
      "password-confirm"?: string;
    };
  }>("/signup", async (request, reply) => {
    const { formData, formErrors } = await validateFormData(request.body, {
      validators: {
        username: [
          invalidMessage(
            validatorNot(validator.isEmpty),
            "Username cannot be empty"
          ),
          async (value) => {
            if (await passwords.usernameExists(value))
              throw new Error("Username already exists");
            return true;
          },
        ],
        password: [
          invalidMessage(
            validatorNot(validator.isEmpty),
            "Password cannot be empty"
          ),
        ],
        "password-confirm": [
          validatorNot(validator.isEmpty),
          async (value: string) => {
            if (request.body.password !== value)
              throw new Error("Passwords do not match");
            return true;
          },
        ],
      },
    });

    if (formErrors) {
      return reply.renderTemplate(templateSignup, { formData, formErrors });
    }

    const { username, password } = formData;
    const id = await services.profiles.create({ username }, { password });
    await request.logIn({ id, username });
    reply.redirect("/");
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


*/
