import type { ReactNode, ElementType, ReactElement } from "react";

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

type APIMethod = (args: any) => Promise<any>;
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

type MantineForm = {
  clearErrors(): void,
  setErrors(arg: Record<string, string>): void
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


let react: any;
try {
  react = require("react");
} catch (err) {
}

type UseErrorResponseReturn = [RequestErrorSetter, string, JSONErrorResponse | undefined];
export function useErrorResponse(form?: MantineForm): UseErrorResponseReturn {
  if (!react) throw new Error("react is undefined");
  const [state, setter]: [JSONErrorResponse | undefined, RequestErrorSetter] = react.useState(undefined);
  const message = mainErrorMessage(state);

  react.useEffect(() => {
    if (form) {
      if (!state || state.preferredErrorDisplay == "form") {
        form.clearErrors();
      } else {
        const result: any = {};
        for (const key in state.invalidFields) {
          result[key] = formatErrorMessage(state.invalidFields[key]);
        }
        form.setErrors(result);
      }
    }
  }, [state]);

  return [setter, message, state];
}


export type UseVarsHelper<Type> = {
  props: (key: keyof Type) => {
    onChange: (e: any) => void;
    value: string;
    placeholder: string;
    error?: string;
    label?: string;
  };
  set: (key: keyof Type, value: any) => void;
  setAll: (obj: Record<keyof Type, any>) => void;
  input: (key: keyof Type) => ReactElement;
}

export type UseVarsOptions<Type> = {
  Comp?: ElementType;
  labels?: Type;
  placeholders: Type;
  initialValues?: Type;
  errorResponse?: JSONErrorResponse;
}

export function useVars<Type extends Record<string, string>>(placeholders: Type): [Record<keyof Type, any>, UseVarsHelper<Type>]
export function useVars<Type extends Record<string, string>>(options: UseVarsOptions<Type>): [Record<keyof Type, any>, UseVarsHelper<Type>]
export function useVars<Type extends Record<string, string>>(arg: Type | UseVarsOptions<Type>): [Record<keyof Type, any>, UseVarsHelper<Type>] {
  const result: Record<keyof Type, any> = {} as any;
  const setDict: Record<keyof Type, any> = {} as any;

  let placeholders: Type, options: UseVarsOptions<Type>;

  if (arg.placeholders && typeof arg.placeholders == "object") {
    options = arg as UseVarsOptions<Type>;
    placeholders = options.placeholders;
  } else {
    placeholders = arg as Type;
    options = {
      placeholders,
    }
  }

  const labels: Partial<Type> = options.labels || {};
  const initialValues: Partial<Type> = options.initialValues || {};
  const { errorResponse, Comp } = options;


  for (const key in placeholders) {
    [result[key], setDict[key]] = react.useState(initialValues[key] || "");
  }

  const helper: UseVarsHelper<Type> = {
    props(key) {
      let error: string | undefined = undefined;
      if (errorResponse && errorResponse.preferredErrorDisplay != "form" && errorResponse.invalidFields[key as string]) {
        error = formatErrorMessage(errorResponse.invalidFields[key as string]);
      }

      return {
        onChange(e) {
          setDict[key](e.target.value);
        },
        label: labels[key],
        value: result[key],
        placeholder: placeholders[key],
        error,
      }
    },
    set(key, value) {
      setDict[key](value);
    },
    setAll(obj) {
      for (const key in obj) {
        setDict[key](obj[key]);
      }
    },
    input(key): ReactElement {
      if (!Comp) {
        return react.createElement("input", this.props(key));
      }
      return react.createElement(Comp, this.props(key));
    }
  };

  return [result, helper];
}



export type FetchCatchOptions<ReturnType, AType> = {
  then?: (arg: ReturnType) => void;
  errorCatcher?: (arg?: JSONErrorResponse) => void;
  before?: (arg: any) => AType | undefined;
  method: (arg: AType) => Promise<ReturnType>;
  buttonRender?: ElementType;
}

export type FetchCatchFetcher<ReturnType, AType> = {
  (arg: AType): (() => Promise<ReturnType>);
  (arg: () => AType): (() => Promise<ReturnType>);
}


export type FetchCatchFactory = {
  <ReturnType>(method: () => Promise<ReturnType>): FetcherCatcher<ReturnType, void>;
  <ReturnType, AType>(method: (arg: AType) => Promise<ReturnType>): FetcherCatcher<ReturnType, AType>;
  <ReturnType, AType>(options: FetchCatchOptions<ReturnType, AType>): FetcherCatcher<ReturnType, AType>;
}

export class FetcherCatcher<ReturnType, AType>{
  protected factory: FetchCatchFactory;
  protected options: FetchCatchOptions<ReturnType, AType>;

  constructor(factory: FetchCatchFactory, options: FetchCatchOptions<ReturnType, AType>) {
    this.factory = factory;
    this.options = options;
  }

  fetcher(): () => Promise<ReturnType>
  fetcher(arg: AType): () => Promise<ReturnType>
  fetcher(arg: () => AType): () => Promise<ReturnType>
  fetcher(arg?: any): () => Promise<ReturnType> {
    if (typeof arg == "function") {
      return () => (this.options.method(arg()))
    }
    return () => (this.options.method(arg));
  }

  action(args?: any) {
    return () => {
      const { errorCatcher, then, before, method } = this.options;
      if (errorCatcher) {
        errorCatcher();
      }

      const methodArgs: AType = before ? before(args) : {} as any;
      if (!methodArgs) return;

      // console.log(options);

      let p: Promise<any> = method(methodArgs)
      if (then)
        p = p.then(then);
      if (errorCatcher)
        p.catch(errorCatcher);
    }
  }

  catch(arg: (arg?: JSONErrorResponse) => void) {
    return this.factory({
      ...this.options,
      errorCatcher: arg,
    });
  }

  then(arg: (arg: ReturnType) => void) {
    this.options.then
    return this.factory({
      ...this.options,
      then: arg,
    });
  }

  before(arg: (arg?: any) => AType) {
    return this.factory({
      ...this.options,
      before: arg,
    });
  }

  buttonElement(arg: ElementType) {
    return this.factory({
      ...this.options,
      buttonRender: arg,
    });
  }

  button(name: string): ReactElement {
    const { buttonRender } = this.options;
    if (buttonRender) {
      return react.createElement(buttonRender, { onClick: this.action() }, name);
    }
    return react.createElement("button", { onClick: this.action() }, name);
  }

  static options<ReturnType, AType>(arg: any): FetchCatchOptions<ReturnType, AType> {
    if (typeof arg !== "function")
      return arg;
    return {
      method: arg
    };
  }
}


export const fetchCatch: FetchCatchFactory = <ReturnType, AType>(arg: any) => {
  return new FetcherCatcher<ReturnType, AType>(fetchCatch, FetcherCatcher.options(arg));
}
