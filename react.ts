import type { ReactNode, ElementType, ReactElement } from "react";
import { JSONErrorResponse, RequestErrorSetter, formatErrorMessage, mainErrorMessage } from "./client";

type MantineForm = {
  clearErrors(): void,
  setErrors(arg: Record<string, string>): void
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

export type BeforeCallback<AType> =
  ((...args: any[]) => Promise<AType | undefined>) |
  ((...args: any[]) => AType | undefined)



export type FetchCatchOptions<ReturnType, AType> = {
  then?: (result: ReturnType, args: AType) => void;
  errorCatcher?: (arg?: JSONErrorResponse) => void;
  before?: BeforeCallback<AType>;
  method?: (arg: AType) => Promise<ReturnType>;
  buttonRender?: ElementType;
  confirm?: (...args: any[]) => Promise<boolean>;
}

export type FetchCatchFetcher<ReturnType, AType> = {
  (arg: AType): (() => Promise<ReturnType>);
  (arg: () => AType): (() => Promise<ReturnType>);
}


export type FetchCatchFactory = {
  <ReturnType, AType>(): FetcherCatcher<ReturnType, AType>;
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
    const { method } = this.options;
    if (!method) throw new Error("Specify method first!");

    if (typeof arg == "function") {
      return () => (method(arg()))
    }
    return () => (method(arg));
  }

  action(...args: any[]) {
    return () => {
      const { errorCatcher, then, before, method, confirm } = this.options;

      const confirmPromise = new Promise<boolean>((resolve) => {
        if (!confirm) resolve(true);
        else confirm(...args).then(resolve);
      });

      confirmPromise.then(confirmed => {
        if (!confirmed) return;

        if (!method) throw new Error("Specify method first!");

        if (errorCatcher) {
          errorCatcher();
        }

        const beforePromise = new Promise<AType | undefined>((resolve) => {
          if (!before) {
            resolve({} as AType);
            return;
          }

          const p = before(...args);
          if (p instanceof Promise) {
            p.then(resolve);
            return;
          }
          resolve(p);
        });

        beforePromise.then(methodArgs => {
          if (!methodArgs) return;
          let p: Promise<any> = method(methodArgs)
            .then(result => {
              if (then)
                then(result, methodArgs);
            });
          if (errorCatcher)
            p.catch(errorCatcher);
        });
      });
    }
  }

  confirm(fn: (...args: any[]) => Promise<boolean>) {
    return this.factory({
      ...this.options,
      confirm: fn,
    });
  }

  method<NewReturnType, NewAType>(method: (args: NewAType) => Promise<NewReturnType>): FetcherCatcher<NewReturnType, NewAType> {
    return <any>this.factory({
      ...this.options,
      method: method as any,
    });
  }

  catch(arg: (arg?: JSONErrorResponse) => void) {
    return this.factory({
      ...this.options,
      errorCatcher: arg,
    });
  }

  then(arg: (result: ReturnType, args: AType) => void) {
    this.options.then
    return this.factory({
      ...this.options,
      then: arg,
    });
  }

  before(arg: BeforeCallback<AType>) {
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


export const fetchCatch: FetchCatchFactory = <ReturnType, AType>(arg?: any) => {
  return new FetcherCatcher<ReturnType, AType>(fetchCatch, FetcherCatcher.options(arg));
}
