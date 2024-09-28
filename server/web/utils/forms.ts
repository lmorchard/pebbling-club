import { html, TemplateContent } from "./html";

export interface FormSchemaValidationError {
  // subset of FastifySchemaValidationError
  instancePath: string;
  message?: string;
}

export type FormValidationError =
  | {
      validation: FormSchemaValidationError[];
      validationContext: string;
    }
  | undefined;

export type FormData = Record<string, any>;

export type FormErrors = Record<string, FormSchemaValidationError[]>;

export interface FieldOptions {
  id?: string;
  type?: string | FieldTemplate;
  required?: boolean;
  autofocus?: boolean;
}

export type FieldTemplate = (
  id: string,
  label: string,
  name: string,
  value: any,
  errors: FormSchemaValidationError[] | undefined,
  options: FieldOptions
) => TemplateContent;

export const addValidationError = (
  validationError: FormValidationError,
  error: FormSchemaValidationError
): FormValidationError => {
  if (!validationError) {
    return {
      validation: [error],
      validationContext: "",
    };
  }
  return {
    ...validationError,
    validation: [...validationError.validation, error],
  };
};

export const mapErrors = (validationError: FormValidationError) => {
  return validationError?.validation.reduce((acc, error) => {
    const key = error.instancePath.slice(1);
    acc[key] = acc[key] || [];
    acc[key].push(error);
    return acc;
  }, {} as FormErrors);
};

export const field = ({
  formData,
  validationError,
}: {
  formData?: FormData;
  validationError?: FormValidationError;
}) => {
  const mappedErrors = mapErrors(validationError);
  return (label: string, name: string, options: FieldOptions = {}) => {
    const id = options.id || `field-${name}`;
    const errors = mappedErrors?.[name];
    const value = formData?.[name];
    return html`
      <label for="${id}">
        <span class="label">${label}</span>
        ${typeof options.type === "function"
          ? options.type(id, label, name, value, errors, options)
          : html`
              <input
                id="${id}"
                name="${name}"
                value="${value}"
                type="${options.type || "text"}"
                ${options.required ? "required" : ""}
                ${options.autofocus ? "autofocus" : ""}
              />
            `}
        ${errors?.map(
          (error) => html`<span class="error">${error.message}</span>`
        )}
      </label>
    `;
  };
};

export const textarea =
  ({ rows = 5 }: { rows?: number }): FieldTemplate =>
  (id, label, name, value, errors, options) =>
    html`
      <textarea
        rows="${rows}"
        id="${id}"
        name="${name}"
        ${options.required ? "required" : ""}
        ${options.autofocus ? "autofocus" : ""}
      >${value}</textarea>
    `;
