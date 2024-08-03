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
  }>("/login", async (request, reply) => {
    const { formData, formErrors } = await validateFormData(request.body, {
      validators: {
        username: [
          invalidMessage(
            validatorNot(validator.isEmpty),
            "Username required"
          ),
        ],
        password: [
          invalidMessage(
            validatorNot(validator.isEmpty),
            "Password required"
          ),
        ],
      },
    });

    if (formErrors) {
      return reply.renderTemplate(templateLogin, { formData, formErrors });
    }

    await FastifyPassport.authenticate(
      "local",
      async (request, reply, err, user, info) => {
        if (user) {
          await request.logIn(user);
          reply.redirect("/");
        } else {
          log.error({ msg: "Authentication error", err });
          return reply.renderTemplate(templateLogin, {
            formData,
            formErrors: { password: [{ message: "Username or password invalid" }] },
          });
        } 
      }
    ).call(fastify, request, reply);
  });

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
            "Username required"
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
            "Password required"
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
