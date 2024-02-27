import { InvalidFieldReason, RequestError, ValidationErrorResponce } from "./client";
import z, { ZodError, ZodIssue, ZodObject } from "zod";

export type APIRequest = {
  method: string,
  args: any
}

export type APIValidationObject = Record<string, ZodObject<any>>

export type InvalidResult = [ValidationErrorResponce, {
  status: number
}];

export type ValidResult = [any, {
  status: number
}];


export type APIObject = Record<string, (args: any) => Promise<any>>;


function invalidResponce(message: string): InvalidResult {
  return [
    {
      message,
      args: [],
      invalidFields: {}
    }, {
      status: 400
    }
  ]
}

function stringifyUnion(union: readonly any[]): string {
  return "(" + union.map(e => `'${e}'`).join(" | ") + ")";
}

export function typeExpectedMessage(expectedType: string, got: any) {
  return `expected to be '${expectedType}' got ${typeof got}: '${got}'`;
}

function typeExpectedReason(expectedType: string, got: any): InvalidFieldReason {
  return {
    message: `expected to be {...} got {...}: {...}`,
    args: [expectedType, typeof got, got + ""],
  }
}



const UserMessages = {
  required: "required field",
  invalid: "field is invalid",
  invalidRequest: "request is invalid",
};

function makeReason(reason: string | InvalidFieldReason): InvalidFieldReason {
  if (typeof reason == "string") {
    return {
      message: reason,
      args: []
    }
  }
  return reason;
}

function arraify<T>(value: T | T[]): T[] {
  if (value instanceof Array) {
    return value;
  }
  return [value];
}

function validate(req: APIRequest, rules: APIValidationObject): Promise<InvalidResult | false>;

function validate(req: APIRequest, rules: APIValidationObject, api: APIObject): Promise<ValidResult | InvalidResult>

async function validate(req: APIRequest, rules: APIValidationObject, api?: APIObject) {
  const { method, args } = req;
  const zodRule = rules[method];
  if (!zodRule) {
    return invalidResponce(`API method '${method}' doesn't exist`);
  }

  const invalidFields: Record<string, InvalidFieldReason> = {};

  let argsParsed;
  try {
    argsParsed = zodRule.parse(args);
  } catch (zErr: any) {
    for (const issue of zErr.issues) {
      const i: ZodIssue = issue;
      invalidFields[i.path.join(".")] = {
        message: i.message,
        args: []
      }
    }

    return [{
      message: "Bad request",
      invalidFields,
    }, {
      status: 400
    }];
  }


  if (!api) {
    return false;
  }

  let result: any;
  try {
    result = await api[method](argsParsed);
  } catch (err: any) {
    if (err instanceof RequestError) {
      return [{
        message: err.message,
        ...err.payload,
      }, {
        status: err.statusCode
      }];
    }
    throw err;
  }

  if (!result) {
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