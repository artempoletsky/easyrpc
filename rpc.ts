import { InvalidFieldReason, JSONErrorResponse } from "./client";
import z, { ZodError, ZodObject } from "zod";

export type APIRequest = {
  method: string,
  args: any
}

export type APIValidationObject = Record<string, ZodObject<any>>

export type InvalidResult = [JSONErrorResponse, {
  status: number
}];

export type ValidResult = [any, {
  status: number
}];


export type APIObject = Record<string, (args: any) => Promise<any>>;


function invalidResponse(message: string, args: string[] = []): InvalidResult {
  return [
    {
      message,
      args,
      statusCode: 400,
      preferredErrorDisplay: "form",
      invalidFields: {}
    }, {
      status: 400
    }
  ]
}

export function typeExpectedMessage(expectedType: string, got: any) {
  return `expected to be '${expectedType}' got ${typeof got}: '${got}'`;
}


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


function validate(req: APIRequest, rules: APIValidationObject): Promise<InvalidResult | false>;

function validate(req: APIRequest, rules: APIValidationObject, api: APIObject): Promise<ValidResult | InvalidResult>

async function validate(req: APIRequest, rules: APIValidationObject, api?: APIObject) {
  const { method, args } = req;
  const zodRule = rules[method];
  if (!zodRule) {
    return invalidResponse(`API method '${method}' doesn't exist`);
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
    result = await api[method](argsParsed);
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

type INextResponse = {
  json: (result: any, statusObj: { status: number }) => any
}

export function NextPOST(NextResponse: INextResponse, rules: APIValidationObject, api: APIObject) {
  return async function (req: any) {
    let [a, b] = await validate(await req.json(), rules, api);
    return NextResponse.json(a, b);
  }
}

export class ResponseError extends Error {
  public readonly statusCode: number;
  public readonly response: JSONErrorResponse;

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
