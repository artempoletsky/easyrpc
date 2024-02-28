


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
  return function setRequestError(err?: ValidationErrorResponse) {
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

export type ValidationErrorResponse = InvalidFieldReason & {
  invalidFields: Record<string, InvalidFieldReason>
};
