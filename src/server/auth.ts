import { FastifyPluginAsync } from "fastify";
import { FromSchema } from "json-schema-to-ts";
import FastifyPassport from "@fastify/passport";
import { IBaseRouterOptions } from "./types";
import templateLogin from "./templates/auth/login";
import templateSignup from "./templates/auth/signup";
import { addValidationError, FormValidationError } from "./utils/forms";
import fp from "fastify-plugin";
import { PasswordService } from "../services/passwords";
import { ProfileService, Profile } from "../services/profiles";

import { Strategy as LocalStrategy } from "passport-local";

export interface IAuthRouterOptions extends IBaseRouterOptions {}

export const PassportAuth = fp(
  async (
    server,
    options: {
      services: {
        passwords: PasswordService;
        profiles: ProfileService;
      };
    }
  ) => {
    const { passwords, profiles } = options.services;

    server.register(FastifyPassport.initialize());
    server.register(FastifyPassport.secureSession());

    FastifyPassport.use(
      "local",
      new LocalStrategy(async function verify(username, password, cb) {
        try {
          // First, verify the username and password
          const passwordId = await passwords.verify(username, password);
          if (!passwordId) return cb(null, false);

          // Then, get the profile associated with the username
          const profile = await profiles.getByUsername(username);
          if (!profile?.id) return cb(null, false);

          return cb(null, { id: profile.id, username });
        } catch (err) {
          return cb(err);
        }
      })
    );

    FastifyPassport.registerUserSerializer(
      async (user: Profile, request) => user.id
    );

    FastifyPassport.registerUserDeserializer(async (id: string, request) => {
      const profile = await profiles.get(id);
      if (!profile?.username) return null;
      return profile;
    });
  }
);

export const AuthRouter: FastifyPluginAsync<IAuthRouterOptions> = async (
  fastify,
  options
) => {
  const { server } = options;
  const { log, app } = server;
  const { services } = app;
  const { passwords } = services;

  fastify.get("/login", async (request, reply) => {
    const csrfToken = await reply.generateCsrf();
    return reply.renderTemplate(templateLogin, { csrfToken });
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

  const loginNextQuerystringSchema = {
    type: "object",
    properties: {
      nextPath: {
        type: "string",
      },
      nextParams: {
        type: "string",
      },
    },
  } as const;

  fastify.post<{
    Body: FromSchema<typeof loginFormSchema>;
    Querystring: FromSchema<typeof loginNextQuerystringSchema>;
  }>(
    "/login",
    {
      attachValidation: true,
      schema: {
        body: loginFormSchema,
        querystring: loginNextQuerystringSchema,
      },
      preValidation: fastify.csrfProtection,
    },
    async (request, reply) => {
      let { nextPath, nextParams } = request.query;
      let formData = request.body;
      let validationError = request.validationError as FormValidationError;

      if (validationError) {
        const csrfToken = await reply.generateCsrf();
        return reply.renderTemplate(templateLogin, {
          csrfToken,
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

            const redirectPath =
              nextPath && nextPath.startsWith("/") ? nextPath : "/";
            let redirectParams = {};
            if (nextParams) {
              try {
                redirectParams = JSON.parse(nextParams);
              } catch (err) {
                /* no-op */
              }
            }
            let redirect = redirectPath;
            const redirectQueryString = new URLSearchParams(
              redirectParams
            ).toString();
            if (redirectQueryString) {
              redirect += `?${redirectQueryString}`;
            }

            return reply.redirect(redirect);
          }

          log.error({ msg: "Authentication error", err });
          validationError = addValidationError(validationError, {
            instancePath: "/password",
            message: "Username or password invalid",
          });
          const csrfToken = await reply.generateCsrf();
          return reply.renderTemplate(templateLogin, {
            csrfToken,
            formData,
            validationError,
          });
        }
      ).call(fastify, request, reply);
    }
  );

  fastify.post("/logout", async (request, reply) => {
    request.logOut();
    return reply.redirect("/");
  });

  fastify.get("/signup", async (request, reply) => {
    const csrfToken = await reply.generateCsrf();
    return reply.renderTemplate(templateSignup, { csrfToken });
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
      preValidation: fastify.csrfProtection,
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
        const csrfToken = await reply.generateCsrf();
        return reply.renderTemplate(templateSignup, {
          csrfToken,
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
