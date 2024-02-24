


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

export type InvalidFieldReason = {
  message: string,
  userMessage: string,
}

export type ValidationErrorResponce = {
  message: string,
  invalidFields: Record<string, InvalidFieldReason>
};

