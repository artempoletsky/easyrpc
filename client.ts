


export function getAPIMethod<MethodType extends (args: any) => Promise<any> = () => Promise<any>>
  (route: string, method: string, options?: Record<string, any>): MethodType {
  if (!options)
    options = {};

  // options = {
  //   ...options
  // };

  return <any>function (args: any) {

    return fetch(route, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method,
        args: args || {}
      }),
      ...options,
    }).then(res => {
      if (res.ok) {
        return res.json();
      }

      return res.json().then(e => {
        throw e;
      });
    });
  }
}

type MantineForm = {
  clearErrors(): void,
  setErrors(arg: Record<string, string>): void
}

export function formatInvalidField(reason: InvalidFieldReason, i18nDict: Record<string, string> = {}): string {
  const message: string = i18nDict[reason.message] || reason.message;
  let parts = message.split("{...}");
  if (parts.length == 1) return parts[0];

  const result: string[] = [];
  const args = reason.args;
  for (let i = 0; i < parts.length; i++) {
    result.push(parts[i]);
    if (args[i]) {
      result.push(args[i])
    }
  }
  return result.join("'");
}

export function useMantineRequestError(form: MantineForm, i18nDict: Record<string, string> = {}) {
  return function setRequestError(err?: ValidationErrorResponce) {
    if (!err) {
      form.clearErrors();
    } else {
      const result: any = {};
      for (const key in err.invalidFields) {
        result[key] = formatInvalidField(err.invalidFields[key], i18nDict);
      }
      form.setErrors(result);
    }
  }
}

export type InvalidFieldReason = {
  message: string,
  args: string[],
}

export type ValidationErrorResponce = InvalidFieldReason & {
  invalidFields: Record<string, InvalidFieldReason>
};

type PlainObject = Record<string, any>

export class RequestError extends Error {
  public readonly statusCode;
  public readonly payload;
  constructor(message: string, statusCode?: number, payload?: PlainObject)
  constructor(payload: PlainObject, statusCode?: number)
  constructor(arg1: string | PlainObject, arg2?: any, arg3?: any) {
    let message = "Bad request";
    let payload: PlainObject;
    let statusCode = arg2 || 400;;
    if (typeof arg1 == "string") {
      message = arg1;
      payload = arg3 || {};
    } else {
      payload = arg1;
    }

    super(message);
    this.statusCode = statusCode;
    this.payload = payload;
  }
}
