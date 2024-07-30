import { html, RenderableTemplate, TemplateContent } from "./html";
import { RequestHandler } from "express";
import {
  validationResult,
  matchedData,
  ValidationError,
  Result,
} from "express-validator";

declare global {
  namespace Express {
    interface Locals {
      validation?: Result<ValidationError>;
      formData?: Record<string, any>;
    }
  }
}

export const withValidation = (): RequestHandler => (req, res, next) => {
  res.locals.validation = validationResult(req);
  res.locals.formData = matchedData(req, { onlyValidData: false });
  return next();
};

export const ifNotValid =
  (notValidHandler: RequestHandler): RequestHandler =>
  (req, res, next) => {
    if (res.locals.validation?.isEmpty()) return next();
    return notValidHandler(req, res, next);
  };

type FieldTemplate = (
  id: string,
  label: string,
  name: string,
  value: any,
  error: ValidationError | undefined,
  options: FieldOptions
) => TemplateContent;

type FieldOptions = {
  id?: string;
  type?: string | FieldTemplate;
  required?: boolean;
};

export const field = (
  validation: Result<ValidationError> | undefined,
  formData: Record<string, any> | undefined
) => {
  const errors = validation?.mapped();
  return (label: string, name: string, options: FieldOptions = {}) => {
    const id = options.id || `field-${name}`;
    const error = errors?.[name];
    const value = formData?.[name];
    return html`
      <label for="${id}">
        <span class="label">${label}</span>
        ${typeof options.type === "function"
          ? options.type(id, label, name, value, error, options)
          : html`
              <input
                id="${id}"
                name="${name}"
                value="${value}"
                type="${options.type || "text"}"
                ${options.required ? "required" : ""}
              />
            `}
        ${error && html`<span class="error">${error.msg}</span>`}
      </label>
    `;
  };
};
