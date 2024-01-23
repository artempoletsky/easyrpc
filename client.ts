

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
    }).then(r => r.json());
  }
}