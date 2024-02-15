


export function getAPIMethod<MethodType extends (args: any) => Promise<any> = () => Promise<any>>
  (route: string, method: string, httpMethod: string = "POST"): MethodType {
  return <any>function (args: any) {
    return fetch(route, {
      method: httpMethod,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method,
        args: args || {}
      })
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

export type ValiationErrorResponce = {
  message: string,
  invalidFields: Record<string, InvalidFieldReason>
};

