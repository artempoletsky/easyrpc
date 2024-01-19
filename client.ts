
export function getAPIMethod<MethodType extends (args: any) => any>
  (route: string, method: string, httpMethod: string = "POST")
  : (args: Parameters<MethodType>[0]) => Promise<ReturnType<MethodType>> {
  return function (args) {
    return fetch(route, {
      method: httpMethod,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method,
        args: args
      })
    }).then(r => r.json() as ReturnType<MethodType>);
  }
}