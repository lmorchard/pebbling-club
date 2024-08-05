import { FastifyPluginAsync } from "fastify";
import { FromSchema } from "json-schema-to-ts";
import FastifyPassport from "@fastify/passport";
import { IBaseRouterOptions } from "./types";
import templateLogin from "../templates/auth/login";
import templateSignup from "../templates/auth/signup";
import { addValidationError, FormValidationError } from "../utils/forms";

export interface IRouterOptions extends IBaseRouterOptions {}

const Router: FastifyPluginAsync<IRouterOptions> = async (fastify, options) => {
  const { server } = options;
  const { log, app } = server;
  const { services } = app;
  const { passwords } = services;

  fastify.get("/login", async (request, reply) => {
    return reply.renderTemplate(templateLogin);
  });

  const loginFormSchema = {
    type: "object",
    properties: {
      username: {
        type: "string",
        minLength: 1,
        errorMessage: {
          type: "Username required",
          minLength: "Username required",
        },
      },
      password: {
        type: "string",
        minLength: 1,
        errorMessage: {
          type: "Password required",
          minLength: "Password required",
        },
      },
    },
    required: ["username", "password"],
  } as const;

  fastify.post<{
    Body: FromSchema<typeof loginFormSchema>;
  }>(
    "/login",
    {
      attachValidation: true,
      schema: {
        body: loginFormSchema,
      },
    },
    async (request, reply) => {
      let formData = request.body;
      let validationError = request.validationError as FormValidationError;

      if (request.validationError) {
        return reply.renderTemplate(templateLogin, {
          formData,
          validationError,
        });
      }

      // HACK: seems an awkward way to call authenticate, but we want to do
      // our own form validation first
      await FastifyPassport.authenticate(
        "local",
        async (request, reply, err, user, info) => {
          if (user) {
            await request.logIn(user);
            reply.redirect("/");
          } else {
            log.error({ msg: "Authentication error", err });
            validationError = addValidationError(validationError, {
              instancePath: "/password",
              message: "Username or password invalid",
            });
            return reply.renderTemplate(templateLogin, {
              formData,
              validationError,
            });
          }
        }
      ).call(fastify, request, reply);
    }
  );

  fastify.post("/logout", async (request, reply) => {
    request.logOut();
    return reply.redirect("/");
  });

  fastify.get("/signup", async (request, reply) => {
    return reply.renderTemplate(templateSignup);
  });

  const signupFormSchema = {
    type: "object",
    properties: {
      username: {
        type: "string",
        minLength: 1,
        errorMessage: {
          type: "Username required",
          minLength: "Username required",
        },
      },
      password: {
        type: "string",
        minLength: 1,
        errorMessage: {
          type: "Password required",
          minLength: "Password required",
        },
      },
      "password-confirm": {
        type: "string",
        minLength: 1,
        errorMessage: {
          type: "Password confirmation required",
          minLength: "Password confirmation required",
        },
      },
    },
    required: ["username", "password", "password-confirm"],
  } as const;

  fastify.post<{
    Body: FromSchema<typeof signupFormSchema>;
  }>(
    "/signup",
    {
      attachValidation: true,
      schema: {
        body: signupFormSchema,
      },
    },
    async (request, reply) => {
      const {
        username,
        password,
        "password-confirm": passwordConfirm,
      } = request.body;

      let validationError = request.validationError as FormValidationError;

      // Should be able to use `const` in schema, but doesn't seem to work with FromSchema type utility
      if (password !== passwordConfirm) {
        validationError = addValidationError(validationError, {
          instancePath: "/password-confirm",
          message: "Passwords do not match",
        });
      }

      if (await passwords.usernameExists(username)) {
        validationError = addValidationError(validationError, {
          instancePath: "/username",
          message: "Username already exists",
        });
      }

      if (validationError) {
        return reply.renderTemplate(templateSignup, {
          formData: request.body,
          validationError,
        });
      }

      const id = await services.profiles.create({ username }, { password });
      await request.logIn({ id, username });
      reply.redirect("/");
    }
  );
};

export default Router;
