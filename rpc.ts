import { InvalidFieldReason, JSONErrorResponse } from "./client";
import z, { ZodEffects, ZodError, ZodObject } from "zod";

export type APIRequest<T extends APIValidationObject = {}, K extends keyof T = keyof T> = {
  method: K;
  args: z.infer<T[K]>;
}

export type APIValidationObject = Record<string, ZodObject<any> | ZodEffects<ZodObject<any>>>

export type InvalidResult = [JSONErrorResponse, {
  status: number
}];

export type ValidResult = [any, {
  status: number
}];


export type APIObject<T extends APIValidationObject, K extends keyof T = keyof T> = {
  [P in K]: (args: z.infer<T[P]>) => Promise<any>
};

export type ZodSolver = (err: ZodError) => JSONErrorResponse;

const defaultZodSolver: ZodSolver = (err) => {
  const invalidFields: Record<string, InvalidFieldReason> = {};

  let firstError: InvalidFieldReason = { message: "", args: [] };
  let firstErrorFieldName: string = "";
  for (const issue of err.issues) {
    const err: InvalidFieldReason = {
      message: issue.message,
      args: []
    }
    const path: string = issue.path.join(".");

    if (!firstErrorFieldName) {
      firstError = err;
      firstErrorFieldName = path;
    }
    invalidFields[path] = err;
  }


  const invalidRes: JSONErrorResponse = {
    message: ResponseError.getManyFieldsErrorMessage(invalidFields),
    statusCode: 400,
    preferredErrorDisplay: "both",
    args: firstError.args,
    invalidFields,
  };

  return invalidRes;
}


export type EasyRPCServerSettings = {
  zodSolver: ZodSolver;
}

const Settings: EasyRPCServerSettings = {
  zodSolver: defaultZodSolver
}


export function settings(settings: Partial<EasyRPCServerSettings>) {
  Object.assign(Settings, settings);
}


function validate<T extends APIValidationObject, K extends keyof T = keyof T>(req: APIRequest<T, K>, rules: T): Promise<InvalidResult | false>;

function validate<T extends APIValidationObject, K extends keyof T = keyof T>(req: APIRequest<T, K>, rules: T, api: APIObject<T, K>): Promise<ValidResult | InvalidResult>

async function validate<T extends APIValidationObject, K extends keyof T & string = keyof T & string>(req: APIRequest<T, K>, rules: T, api?: APIObject<T, K>) {
  const { method, args } = req;
  const zodRule = rules[method];
  if (!zodRule) {
    const err = ResponseError.methodNotAllowed(`API method '${method}' doesn't exist`);
    return [err.response, {
      status: err.statusCode,
    }];
  }

  let argsParsed;
  try {
    argsParsed = zodRule.parse(args);
  } catch (zErr: any) {
    if (zErr.issues && zErr.issues.length) {
      const invalidRes = Settings.zodSolver(zErr);
      return [invalidRes, {
        status: invalidRes.statusCode,
      }];
    }
    throw zErr;
  }


  if (!api) {
    return false;
  }

  let result: any;
  try {
    result = await (api as any)[method](argsParsed);
  } catch (err: any) {
    const e: JSONErrorResponse | ResponseError | Error = err;
    if ("statusCode" in e) {
      const response = "response" in e ? e.response : e;
      return [response, {
        status: e.statusCode
      }];
    }
    throw err;
  }

  if (result === undefined) {
    result = "";
  }

  return [
    result,
    {
      status: 200
    }
  ];
}


export default validate;


export class ResponseError extends Error {
  public readonly statusCode: number;
  public readonly response: JSONErrorResponse;

  static createWithStatus(statusCode: number, message: string, args?: string[]) {
    return new ResponseError({
      message,
      statusCode,
      args,
    });
  }

  static unauthorized(message?: string, args?: string[]) {
    return this.createWithStatus(401, message ?? "Unauthorized", args);
  }

  static forbidden(message?: string, args?: string[]) {
    return this.createWithStatus(403, message ?? "Forbidden", args);
  }

  static notFound(message?: string, args?: string[]) {
    return this.createWithStatus(404, message ?? "Not Found", args);
  }

  static methodNotAllowed(message?: string, args?: string[]) {
    return this.createWithStatus(405, message ?? "Method Not Allowed", args);
  }

  static getMainErrorMessageForField(fieldName: string, fieldMessage: string) {
    return `Field ${fieldName} has an error: ${fieldMessage}`;
  }

  static getManyFieldsErrorMessage(invalidFields: Record<string, InvalidFieldReason>) {
    return `Following fields contains errors: ${Object.keys(invalidFields).join(", ")}`;
  }

  constructor(message: string, args?: string[])
  constructor(field: string, message: string, args?: string[])
  constructor(response: Partial<JSONErrorResponse>)
  constructor(error: ZodError)
  constructor(error: ResponseError)
  constructor(error: Error)
  constructor(arg1: string | Partial<JSONErrorResponse> | Error | ZodError | ResponseError, arg2?: string | string[], arg3?: string[]) {
    let message: string;
    let response: Partial<JSONErrorResponse>;
    let statusCode: number;
    let args: string[];
    if (typeof arg1 != "string") {
      if ("response" in arg1) {
        response = arg1.response;
      } else if ("issues" in arg1) {
        const invalidFields: Record<string, InvalidFieldReason> = {};
        for (const isssue of arg1.issues) {
          invalidFields[isssue.path.join(".")] = {
            message: isssue.message,
            args: [],
          }
        }
        response = {
          message: arg1.message,
          invalidFields,
        }
      } else if ("stack" in arg1) {
        response = {
          message: arg1.message,
        }
      } else {
        response = arg1
      }
      if (!response.message && response.invalidFields) {
        response.message = ResponseError.getManyFieldsErrorMessage(response.invalidFields);
      }
    } else if (typeof arg2 == "string") {
      args = arg3 || [];
      // message = ResponseError.getManyFieldsErrorMessage(arg1, arg2);
      const invalidFields = {
        [arg1]: {
          message: arg2,
          args,
        }
      };

      response = {
        message: ResponseError.getManyFieldsErrorMessage(invalidFields),
        args,
        preferredErrorDisplay: "field",
        invalidFields,
      };
    } else {
      response = {
        message: arg1,
        args: arg2 || [],
        preferredErrorDisplay: "form",
      }
    }

    message = response.message || "Bad request";
    statusCode = response.statusCode || 400;

    super(message);
    this.statusCode = statusCode;
    this.response = {
      message,
      args: [],
      statusCode,
      invalidFields: {},
      preferredErrorDisplay: "both",
      ...response,
    };

  }
}



type INextResponse = {
  json: (result: any, statusObj: { status: number }) => any
}


let NextResponse: INextResponse;
try {
  NextResponse = require("next/server").NextResponse;
} catch (error) {

}


export function NextPOST<T extends APIValidationObject, K extends keyof T = keyof T>(rules: T, api: APIObject<T, K>) {
  if (!NextResponse) throw new Error("Failed to require NextResponse");

  return async function (request: any) {
    let req: any;
    try {
      req = await requestToRPCRequest(request);
    } catch (err) {
      return NextResponse.json(err, {
        status: (<JSONErrorResponse>err).statusCode
      });
    }
    let [a, b] = await validate(req, rules, api);
    return NextResponse.json(a, b);
  }
}


import type http from "http";
import pkg from "./package.json";
export type AHttpListener<T extends APIValidationObject, K extends keyof T> = {
  httpGetFallback?: string;
  rules: T;
  api: APIObject<T, K>;
};
export function httpListener<T extends APIValidationObject, K extends keyof T = keyof T>({ httpGetFallback, api, rules }: AHttpListener<T, K>) {
  return function (req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage }) {
    if (req.method == "OPTIONS") {
      res.writeHead(204, {
        // "Date": (new Date()).toString(),
        "Server": "Mydb 0.0.1",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Request-Headers": "X-PINGOTHER, Content-Type",
        "Access-Control-Allow-Headers": "Access-Control-Allow-Headers, Origin, Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers",
        "Access-Control-Max-Age": "86400",
        "Vary": "Accept-Encoding, Origin",
        "Keep-Alive": "timeout=2, max=100",
        "Connection": "Keep-Alive",
      });
      res.end();
      return;
    }


    let body: any[] = [];
    let bodystr: string;
    req
      .on("data", chunk => {
        body.push(chunk);
      })
      .on("end", async () => {
        bodystr = Buffer.concat(body).toString();

        const [postResult, status] = await request(bodystr, req.method || "GET");
        res.statusCode = status;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.write(JSON.stringify(postResult));

        res.end();
      });
  }

  async function request(requestStr: string, httpMethod: string): Promise<[any, number]> {
    let requestObject: any;

    if (httpMethod == "POST") {
      try {
        requestObject = JSON.parse(requestStr);
      } catch (error) {
        const err = ResponseError.createWithStatus(400, "Invalid JSON request body");
        return [err.response, 400];
      }

      if (!requestObject.args || !requestObject.method) {
        const err = ResponseError.createWithStatus(400, "Method or args are missing");
        return [err.response, 400];
      }

      const [response, status] = await validate(requestObject, rules, api);
      return [response, status.status];
    } else {
      return [httpGetFallback ?? `EasyRPC server (${pkg.version})`, 200];
    }
  }
}


const ZArrStr = z.array(z.string().min(1));


export function setByPath(object: any, path: string[], value: any) {
  let current = object;
  for (let i = 0; i < path.length; i++) {
    let key: string | number = path[i];
    let next;
    if (current[key] !== undefined) {
      next = current[key];
    } else {
      key = parseInt(key);
      if (current[key] === undefined) {
        throw new Error("Invalid path");
      }
      next = current[key];
    }


    if (i == path.length - 1) {
      current[key] = value;
      return;
    }
    current = next;
  }

  throw new Error("Invalid path");
}

export async function requestToRPCRequest(request: Request): Promise<APIRequest<Record<string, any>>> {
  const contentType = request.headers.get("content-type");
  const isJson = contentType == "application/json";
  let result: APIRequest<Record<string, any>>;
  if (isJson) {
    try {
      result = await request.json();
    } catch (err) {
      throw ResponseError.createWithStatus(400, "Invalid JSON request body");
    }
  } else {
    let fd: FormData;
    try {
      fd = await request.formData();
    } catch (err) {
      throw ResponseError.createWithStatus(400, "Invalid FormData request body");
    }

    const argsStr = fd.get("args") as string;
    if (!argsStr) throw ResponseError.createWithStatus(400, "Invalid FormData request body");

    let args;
    try {
      args = JSON.parse(argsStr);
    } catch (err) {
      throw ResponseError.createWithStatus(400, "Invalid FormData request body");
    }

    const files = fd.getAll("files");
    const filePathsStr = fd.get("filePaths") as string;

    if (filePathsStr) {
      let filePaths: string[];
      try {
        filePaths = JSON.parse(filePathsStr);
      } catch (err) {
        throw ResponseError.createWithStatus(400, "Invalid filePaths");
      }
      const zRes = ZArrStr.safeParse(filePaths);
      if (!zRes.success)
        throw ResponseError.createWithStatus(400, "Invalid filePaths");

      filePaths = zRes.data;
      for (let i = 0; i < filePaths.length; i++) {
        const path = filePaths[i].split("/");
        if (!files[i]) throw ResponseError.createWithStatus(400, "Invalid files");
        try {
          setByPath(args, path, files[i]);
        } catch (err) {
          throw ResponseError.createWithStatus(400, "Invalid filePaths");
        }
      }
    }
    result = {
      method: fd.get("method") as string,
      args,
    };
  }

  if (!result.method) throw ResponseError.createWithStatus(400, "Method is required");
  if (!result.args) throw ResponseError.createWithStatus(400, "Arguments are required");
  return result;
}