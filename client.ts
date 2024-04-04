

function getResponseErrorPromise(res: Response): Promise<JSONErrorResponse> {

  return new Promise((resolve, reject) => {
    res.json().then(resolve as any).catch(e => {
      resolve({
        message: "Unknown error occured {...}",
        args: [res.status + ""],
        preferredErrorDisplay: "form",
        invalidFields: {},
        statusCode: res.status
      });
    });
  });
}

type APIMethod = (...args: any[]) => Promise<any>;
export function getAPIMethod<MethodType extends APIMethod = () => Promise<any>>
  (route: string, method: string, options?: Record<string, any>): MethodType {
  if (!options)
    options = {};

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
      if (res.ok) return res.json();

      return getResponseErrorPromise(res).then(e => { throw e });
    });
  }
}


export function mainErrorMessage(response?: JSONErrorResponse): string {
  if (!response) return "";
  if (response.preferredErrorDisplay == "field") return "";
  return formatErrorMessage(response);
}


export function formatErrorMessage(reason: InvalidFieldReason): string {
  const message: string = Settings.i18n[reason.message] || reason.message;
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
  return result.join(Settings.quotesSymbol);
}

export type RequestErrorSetter = {
  (): void;
  (err: JSONErrorResponse): void;
}

export type InvalidFieldReason = {
  message: string;
  args: string[];
}

export type JSONErrorResponse = InvalidFieldReason & {
  invalidFields: Record<string, InvalidFieldReason>;
  statusCode: number;
  preferredErrorDisplay: "field" | "form" | "both";
};


export type EasyRPCClientSettings = {
  i18n: Record<string, string>;
  quotesSymbol: string;
}

const Settings: EasyRPCClientSettings = {
  i18n: {},
  quotesSymbol: "'",
}

export function settings(settings: Partial<EasyRPCClientSettings>) {
  Object.assign(Settings, settings);
}

