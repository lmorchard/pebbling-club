import { fdatasync, fstat } from "fs";
import { html, TemplateContent } from "./html";

export type FormValidationError = {
  message?: String;
};

export type FormData = Record<string, string>;

export type FormErrors = Record<string, FormValidationError[]>;

export type FormDataFilter = (value: string) => string;

export type FormDataValidator = (value: string) => boolean | Promise<boolean>;

export type FieldOptions = {
  id?: string;
  type?: string | FieldTemplate;
  required?: boolean;
  autofocus?: boolean;
};

export type FieldTemplate = (
  id: string,
  label: string,
  name: string,
  value: any,
  errors: FormValidationError[] | undefined,
  options: FieldOptions
) => TemplateContent;

export const validatorNot = (validator: FormDataValidator) => (value: any) =>
  !validator(value);

export const invalidMessage =
  (validator: FormDataValidator, message: string) => (value: any) => {
    if (!validator(value)) throw new Error(message);
    return true;
  };

export async function validateFormData<FD extends FormData>(
  rawFormData: FD,
  {
    filters,
    validators,
  }: {
    filters?: Partial<Record<keyof FD, FormDataFilter[]>>;
    validators?: Partial<Record<keyof FD, FormDataValidator[]>>;
  },
  defaultMessage: string = "Invalid input"
): Promise<{
  formData: Record<keyof FD, string>;
  formErrors?: FormErrors;
}> {
  const formData: Record<keyof FD, string> = { ...rawFormData };
  for (const name in formData) {
    const fieldFilters = filters?.[name] || [];
    formData[name] = fieldFilters.reduce(
      (value, filter) => filter(value),
      formData[name]
    );
  }

  const formErrors: FormErrors = {};
  for (const [name, value] of Object.entries(formData)) {
    const fieldValidators = validators?.[name] || [];
    const results: FormValidationError[] = [];
    for (const validator of fieldValidators) {
      try {
        if (!(await validator(value)))
          results.push({ message: defaultMessage });
      } catch (error) {
        results.push({
          message: error instanceof Error ? error.message : "" + error,
        });
      }
      if (results.length) {
        formErrors[name] = results;
      }
    }
  }

  return {
    formData,
    formErrors: Object.keys(formErrors).length > 0 ? formErrors : undefined,
  };
}

export const field = ({
  formData,
  formErrors,
}: {
  formData?: FormData;
  formErrors?: FormErrors;
}) => {
  return (label: string, name: string, options: FieldOptions = {}) => {
    const id = options.id || `field-${name}`;
    const errors = formErrors?.[name];
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
