

export function textToJSONErrorResponse(str: string, status: number): JSONErrorResponse {
  let res: JSONErrorResponse;
  try {
    res = JSON.parse(str);
  } catch (err) {
    return {
      message: "Unknown error occured {...}",
      args: [status + ""],
      preferredErrorDisplay: "form",
      invalidFields: {},
      statusCode: status
    }
  }
  return res;
}

function getResponseErrorPromise(res: Response): Promise<JSONErrorResponse> {

  return new Promise((resolve, reject) => {
    res.json().then(resolve as any).catch(e => {
      resolve(textToJSONErrorResponse("", res.status));
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


export function packUploadArguments(arg: Record<string, any>): {
  files: File[];
  args: string;
  filePaths: string;
} {

  const files: File[] = [];

  const filesPaths: string[] = [];

  const recur = (current: any, path: string[]): any => {
    if (typeof current != "object") {
      return current;
    }

    if (current instanceof File) {
      const result = `file[${files.length}]`;
      files.push(current);
      filesPaths.push(path.join("/"));
      return result;
    }

    if (current instanceof Array) {
      return current.map((el, i) => recur(el, [...path, i + ""]));
    }

    const result: Record<string, any> = {};
    for (const key in current) {
      result[key] = recur(current[key], [...path, key]);
    }
    return result;
  }

  const queryRes: Record<string, any> = recur(arg, []);
  return {
    files,
    args: JSON.stringify(queryRes),
    filePaths: JSON.stringify(filesPaths),
  };
}

export function createUploadFormData(arg: Record<string, any>): FormData {
  const { files, args, filePaths } = packUploadArguments(arg);
  var data = new FormData();

  for (const f of files) {
    data.append("files", f);
  }
  data.append("args", args);
  data.append("filePaths", filePaths);
  return data;
}

export function getUploadMethod(route: string, method: string) {

  let onProgress = (progress: number, event: ProgressEvent<XMLHttpRequestEventTarget>) => {

  }

  let onUploadingChange = (isUploading: boolean) => {

  }
  const result = (arg: Record<string, any>) => {
    const xhr = new XMLHttpRequest();

    onUploadingChange(true);

    xhr.upload.addEventListener("progress", (event) => {
      const progressNum = Math.floor(100 * (event.loaded / event.total));
      onProgress(progressNum, event);
    });

    const fd = createUploadFormData(arg);
    fd.append("method", method);
    xhr.open("POST", route, true);
    xhr.send(fd);

    return new Promise((resolve, reject) => {
      xhr.addEventListener("loadend", (e) => {
        onUploadingChange(false);

        if (xhr.status != 200) {
          reject(textToJSONErrorResponse(xhr.responseText, xhr.status))
          return;
        }
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (err: any) {
          reject({
            message: "Invalid JSON {...}",
            args: [err.toString()],
            invalidFields: {},
            preferredErrorDisplay: "both",
            statusCode: 200,
          } satisfies JSONErrorResponse);
        }
      });
    });
  }

  result.onProgress = (cb: typeof onProgress) => {
    onProgress = cb;
  };

  result.onUploadingChange = (cb: typeof onUploadingChange) => {
    onUploadingChange = cb;
  };
  return result;
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


export function RPC<PKG extends Record<string, APIMethod>>(route: string, fetchOptions?: Record<string, any>) {

  return {
    methods<T extends keyof PKG>(...names: T[]): { [P in T]: PKG[P] } {
      const result: any = {};
      for (const n of names) {
        result[n] = this.method(n);
      }
      return result;
    },
    method<T extends keyof PKG>(name: T): PKG[T] {
      return getAPIMethod(route, name as any, fetchOptions) as any;
    },
    /**
     * Type hack method. You can pass name of a method 
     * as a string to a component and the component will know the type of the method too.
     * @param name - the name of the method
     * @returns string name
     */
    hack<T extends keyof PKG>(name: T): PKG[T] {
      return name as any;
    },
    /**
     * Type hack method. You can pass name of a method 
     * as a string to a component and the component will know the type of the method too.
     * @param name - the name of the method
     * @returns string route?name
     */
    hackRoute<T extends keyof PKG>(name: T): PKG[T] {
      return (route + "?" + (name as string)) as any;
    },

    upload<T extends keyof PKG>(name: T): PKG[T] & {
      onProgress: (cb: (progress: number, event: ProgressEvent<XMLHttpRequestEventTarget>) => void) => void;
      onUploadingChange: (cb: (isUploading: boolean) => void) => void;
    } {
      return getUploadMethod(route, name as string) as any;
    }
  }
}
