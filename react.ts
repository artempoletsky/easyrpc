import type { ReactNode, ElementType, ReactElement, Component, ComponentType } from "react";
import type React from "react";
import { JSONErrorResponse, RequestErrorSetter, formatErrorMessage, mainErrorMessage } from "./client";

type MantineForm = {
  clearErrors(): void,
  setErrors(arg: Record<string, string>): void
}


let react: typeof React;
try {
  react = require("react");
} catch (err) {
}


type ThenState<ReturnType> = {
  result: ReturnType;
  setResult: React.SetStateAction<ReturnType>;
}

type CatchState = {
  errorSetter: RequestErrorSetter;
  errorMessage: string;
  errorResponse: JSONErrorResponse | undefined;
}

type UseErrorResponseReturn = [RequestErrorSetter, string, JSONErrorResponse | undefined];
export function useErrorResponse(form?: MantineForm): UseErrorResponseReturn {
  if (!react) throw new Error("react is undefined");
  const [state, setter] = react.useState<JSONErrorResponse | undefined>(undefined);
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

  return [setter as RequestErrorSetter, message, state];
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
  Comp?: ReactComponent;
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

export type BeforeCallback<AType, BeforeType = void> =
  ((arg: BeforeType) => Promise<AType | undefined>) |
  ((arg: BeforeType) => AType | undefined);


type ReactComponent = React.ElementType | React.ComponentType | ((args: any) => React.ReactNode | JSX.Element);

export type FetchCatchOptions<ReturnType, AType, BeforeType = void> = {
  then?: (result: ReturnType, args: AType) => void;
  errorCatcher?: (arg?: JSONErrorResponse) => void;
  before?: BeforeCallback<AType, BeforeType>;
  method?: (arg: AType) => Promise<ReturnType>;
  buttonComponent?: ReactComponent;
  confirm?: (arg: BeforeType) => Promise<boolean>;
}

export type FetchCatchFetcher<ReturnType, AType> = {
  (arg: AType): (() => Promise<ReturnType>);
  (arg: () => AType): (() => Promise<ReturnType>);
}


export type FetchCatchFactory = {
  (): FetcherCatcher<unknown, unknown, void>;
  <ReturnType>(method: () => Promise<ReturnType>): FetcherCatcher<ReturnType, void, void>;
  <ReturnType, AType>(method: (arg: AType) => Promise<ReturnType>): FetcherCatcher<ReturnType, AType, void>;
  <ReturnType, AType, BeforeType = void>(options: FetchCatchOptions<ReturnType, AType, BeforeType>): FetcherCatcher<ReturnType, AType, BeforeType>;
}

export class FetcherCatcher<ReturnType, AType, BeforeType = void> {
  protected factory: FetchCatchFactory;
  protected options: FetchCatchOptions<ReturnType, AType, BeforeType>;

  constructor(factory: FetchCatchFactory, options: FetchCatchOptions<ReturnType, AType, BeforeType>) {
    this.factory = factory;
    this.options = options;
  }

  /**
   * Creates a fetcher function for the useSWR hook.
   * @param arg Arguemnts for the API method
   * @returns callback
   */
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

  /**
   * Creates a callback that stars the function chain without arguments.
   * @param arg Arguemnts for the API method
   * @returns callback
   */
  action(arg: BeforeType) {
    return () => {
      const { errorCatcher, then, before, method, confirm } = this.options;

      const confirmPromise = new Promise<boolean>((resolve) => {
        if (!confirm) resolve(true);
        else confirm(arg).then(resolve);
      });

      confirmPromise.then(confirmed => {
        if (!confirmed) return;

        if (!method) throw new Error("Specify method first!");

        if (errorCatcher) {
          errorCatcher();
        }

        const beforePromise = new Promise<AType | undefined>((resolve) => {
          if (!before) {
            resolve((arg || {}) as AType);
            return;
          }

          const p = before(arg);
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

  /**
   * Sets the Confirm function to the function chain.
   * @param fn confirm implementation. If it returns a falsy value the function chain will be aborted.
   * @returns new FetcherCatcher instance
   */
  confirm(fn: (arg: BeforeType) => Promise<boolean>) {
    return this.factory({
      ...this.options,
      confirm: fn,
    });
  }

  /**
   * Sets the API method in the function chain.
   * @param method API method
   * @returns new FetcherCatcher instance
   */
  method<NewReturnType, NewAType>(method: (args: NewAType) => Promise<NewReturnType>): FetcherCatcher<NewReturnType, NewAType, BeforeType> {
    return <any>this.factory({
      ...this.options,
      method: method as any,
    });
  }

  /**
   * Sets the Catcher function for the API requests.
   * @param fn  callback that runs after failed requests.
   * @returns new FetcherCatcher instance
   */
  catch(arg: (arg?: JSONErrorResponse) => void) {
    return this.factory({
      ...this.options,
      errorCatcher: arg,
    });
  }

  /**
   * Sets the Then callback in the function chain.
   * @param fn callback that runs after successful requests.
   * @returns new FetcherCatcher instance
   */
  then(fn: (result: ReturnType, args: AType) => void) {
    this.options.then
    return this.factory({
      ...this.options,
      then: fn,
    });
  }

  /**
   * Sets the Before callback in the function chain.
   * @param fn callback that runs before requests. Must return arguments for the API method.
   * @returns new FetcherCatcher instance
   */
  before(fn: BeforeCallback<AType, void>): FetcherCatcher<ReturnType, AType, void>
  before<NewBeforeType = BeforeType>(fn: BeforeCallback<AType, NewBeforeType>): FetcherCatcher<ReturnType, AType, NewBeforeType>
  before<NewBeforeType = BeforeType>(fn: BeforeCallback<AType, NewBeforeType>): FetcherCatcher<ReturnType, AType, NewBeforeType> {
    return this.factory({
      ...this.options,
      before: fn as any,
    }) as any;
  }

  /**
   * Sets the Button component class for the button method.
   * @param arg something for the react.createElement(arg). Default is "button".
   * @returns new FetcherCatcher instance
   */
  buttonComponent(arg: ReactComponent) {
    return this.factory({
      ...this.options,
      buttonComponent: arg,
    });
  }

  /**
   * Creates a button - React element that runs current API method.
   * @param innerText text on the button.
   * @param arg arguments for the Before function
   * @returns react.createElement()
   */
  button(innerText: string, arg: BeforeType): ReactElement {
    return react.createElement(this.options.buttonComponent || "button", { onClick: this.action(arg) }, innerText);
  }

  /**
   * Starts the function chain.
   * @param arg arguments for the Before function
   */
  handle(arg: BeforeType) {
    this.action(arg)();
  }

  /**
   * Creates a React state for error messages. 
   * Sets the default errorCatcher.
   * MODIFIES THE CURRENT FetcherCatcher instance.
   */
  useCatch(): CatchState {
    const [errorSetter, errorMessage, errorResponse] = useErrorResponse();
    this.options.errorCatcher = errorSetter;
    return {
      errorSetter,
      errorMessage,
      errorResponse,
    }
  }


  /**
   * Creates a React state for the method's return value.
   * Sets the default Then function that just puts ReturnType to the result constant.
   * MODIFIES THE CURRENT FetcherCatcher instance.
   * @param initial initial value of the `result` constant. 
   */
  useThen<InitialT extends ReturnType | undefined = undefined>(initial?: InitialT): ThenState<
    InitialT extends undefined ?
    ReturnType | undefined :
    ReturnType> {
    const [result, setResult] = react.useState(initial as any);
    this.options.then = setResult;
    return {
      result,
      setResult,
    } as any;
  }

  /**
   * Creates React states for the method's return value and error messages.
   * Sets the default Then function and the default errorCatcher. 
   * MODIFIES THE CURRENT FetcherCatcher instance.
   * 
   * Combines useThen and useCatch.
   * @param initial initial value of the `result` constant. 
   */
  useThenCatch<InitialT extends ReturnType | undefined = undefined>(initial?: InitialT) {
    return {
      ...this.useCatch(),
      ...this.useThen(initial),
    };
  }


  /**
   * 
   * Use this for creating a custom fetchCatch function.
   * @param initial initial value of the `result` constant. 
   */
  static options<ReturnType, AType, BeforeType>(arg: any): FetchCatchOptions<ReturnType, AType, BeforeType> {
    if (typeof arg !== "function")
      return arg;
    return {
      method: arg
    };
  }
}

/**
 * FetcherCatcher factory
 */
export const fetchCatch: FetchCatchFactory = <ReturnType, AType, BeforeType = void>(arg?: any) => {
  return new FetcherCatcher<ReturnType, AType, BeforeType>(fetchCatch, FetcherCatcher.options(arg));
}
