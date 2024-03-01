import { describe, expect, test, beforeAll } from "@jest/globals";
import validate, { APIRequest, APIValidationObject, InvalidResult, ResponseError } from "../rpc";
import z, { object } from "zod";
import { InvalidFieldReason, JSONErrorResponse, formatErrorMessage, settings } from "../client";


const xdescribe = (...args: any) => { };
const xtest = (...args: any) => { };


describe("Validator", () => {

  const addTodoRules: APIValidationObject = {
    addTodo: z.object({
      name: z.string()
    })
  };

  const correctaddTodoRequest = {
    method: "addTodo",
    args: {
      name: "nothing"
    }
  };

  test("validates required methods", async () => {

    const api = {
      addTodo: jest.fn()
    };

    let [res, status] = await validate(correctaddTodoRequest, addTodoRules, api);
    expect(res).toBe("");
    expect(status.status).toBe(200);
    expect(api.addTodo).toHaveBeenCalled();

    const incorrectRequest = {
      method: "bar",
      args: {}
    };

    [res, status] = await validate(incorrectRequest, addTodoRules, api);
    expect(status.status).toBeLessThan(500);
    expect(status.status).toBeGreaterThanOrEqual(400);
    expect(res.message).toBe(`API method 'bar' doesn't exist`);
  });

  test("validates required fields", async () => {
    const api = {
      addTodo: jest.fn()
    };

    const incorrectRequest = {
      method: "addTodo",
      args: {}
    };

    const [res, status]: [JSONErrorResponse, any] = await validate(incorrectRequest, addTodoRules, api);
    expect(api.addTodo).not.toHaveBeenCalled();
    expect(status.status).toBeLessThan(500);
    expect(status.status).toBeGreaterThanOrEqual(400);
    expect(res.message).toBe(`Following fields contains errors: name`);

    expect(res.invalidFields.name).toBeDefined();
    expect(res.invalidFields.name.message).toBe(`Required`);

    expect(res.preferredErrorDisplay).toBe("field");
  });


  test("validates without API", async () => {

    let res = await validate(correctaddTodoRequest, addTodoRules);
    expect(res).toBe(false);

    const incorrectRequest = {
      method: "addTodo",
      args: {}
    };

    const invalidRes = await validate(incorrectRequest, addTodoRules);
    expect(invalidRes).not.toBe(false)
    if (!invalidRes) {
      return;
    }
    expect(invalidRes[0].message).toBe(`Following fields contains errors: name`);
    expect(invalidRes[0].invalidFields.name).toBeDefined();
  });


  test("checks for null", async () => {
    const incorrectRequest = {
      method: "addTodo",
      args: {
        name: null
      }
    };
    const invalidRes = await validate(incorrectRequest, addTodoRules);
    expect(invalidRes).not.toBe(false);
    if (!invalidRes) return;

    expect(invalidRes[0].invalidFields.name.message).toBe("Expected string, received null");
  });


  const arrayExampleRules: APIValidationObject = {
    sendArray: z.object({
      array: z.array(z.string())
    })
  };

  const correctArrayRequest = {
    method: "sendArray",
    args: {
      array: ["1", "2"]
    }
  };

  test("validates arrays", async () => {
    const api = {
      sendArray: jest.fn()
    }
    const validResult = await validate(correctArrayRequest, arrayExampleRules, api);
    expect(validResult[1].status).toBe(200);
    // console.log(api.sendArray.mock.calls[0][0]);
    expect(api.sendArray.mock.calls[0][0].array[1]).toBe("2");


    const invalidRes = await validate({
      method: "sendArray",
      args: {
        array: "foo"
      }
    }, arrayExampleRules);
    expect(invalidRes).not.toBe(false);
    if (!invalidRes) return;
    expect(invalidRes[0].invalidFields.array.message).toBe("Expected array, received string");


    const invalidRes2 = await validate({
      method: "sendArray",
      args: {
        array: ["a", 2, "b", "c"]
      }
    }, arrayExampleRules);

    expect(invalidRes2).not.toBe(false);
    if (!invalidRes2) return;
    expect(invalidRes2[0].invalidFields["array.1"].message).toBe("Expected string, received number");
  });


  test("validates emails", async () => {
    const INVALID_EMAIL_STR = "Invalid email";

    const rules: APIValidationObject = {
      testMethod: z.object({
        arg1: z.string().email(),
        arg2: z.string().email().optional(),
      })
    };

    const validResult = await validate({
      method: "testMethod",
      args: {
        arg1: "johndoe@example.com",
        arg2: "johndoe@example.com",
      }
    }, rules);

    expect(validResult).toBe(false);

    const invalidResult1 = await validate({
      method: "testMethod",
      args: {
        arg1: "johndoe",
        arg2: "johndoe",
      }
    }, rules);

    expect(invalidResult1).not.toBe(false);
    if (!invalidResult1) return;

    expect(invalidResult1[0].invalidFields.arg1.message).toBe(INVALID_EMAIL_STR);
    expect(invalidResult1[0].invalidFields.arg2.message).toBe(INVALID_EMAIL_STR);


    const invalidResult2 = await validate({
      method: "testMethod",
      args: {
        arg1: undefined,
        arg2: undefined,
      }
    }, rules);

    expect(invalidResult2).not.toBe(false);
    if (!invalidResult2) return;

    expect(invalidResult2[0].invalidFields.arg2).not.toBeDefined();
    expect(invalidResult2[0].invalidFields.arg1.message).toBe("Required");
  });

  test("supports nested objects", async () => {
    const rules: APIValidationObject = {
      methodName: z.object({
        level1: z.object({
          level2: z.object({
            level3: z.string()
          })
        })
      })
    }

    const validResult = await validate({
      method: "methodName",
      args: {
        level1: {
          level2: {
            level3: "foo"
          }
        }
      }
    }, rules);

    expect(validResult).toBe(false);

    const invalidResult1 = await validate({
      method: "methodName",
      args: {
        level1: {
          level2: {
            level3: 0
          }
        }
      }
    }, rules);

    expect(invalidResult1).not.toBe(false);
    if (!invalidResult1) return;

    expect(invalidResult1[0].invalidFields["level1.level2.level3"].message).toBe("Expected string, received number");


    const invalidResult2 = await validate({
      method: "methodName",
      args: {
        level1: {
        }
      }
    }, rules);

    expect(invalidResult2).not.toBe(false);
    if (!invalidResult2) return;
    expect(invalidResult2[0].invalidFields["level1.level2"].message).toBe("Required");
  });


  test("union", async () => {
    const rules: APIValidationObject = {
      test: z.object({
        testArg1: z.union([z.literal("foo"), z.literal("bar"), z.literal("baz")])
      })
    }

    let res = await validate({
      method: "test",
      args: { testArg1: "123" }
    }, rules);
    expect(res).toBeTruthy();
    if (!res) return;
    expect(res[0].invalidFields.testArg1.message).toBe("Invalid input");

    res = await validate({
      method: "test",
      args: { testArg1: "bar" }
    }, rules);

    expect(res).toBeFalsy();
  });


  test("formatInvalidField", () => {
    const i18nRU = {
      "Bad request": "Плохой запрос",
      "Template {...}": "Шаблон {...}",
    }
    const reason1: InvalidFieldReason = {
      message: "Bad request",
      args: []
    };
    const res1 = formatErrorMessage(reason1);
    expect(res1).toBe("Bad request");

    const reason2: InvalidFieldReason = {
      message: "Missing i18n",
      args: []
    };
    const res2 = formatErrorMessage(reason2);
    expect(res2).toBe("Missing i18n");

    const reason3: InvalidFieldReason = {
      message: "Template {...}",
      args: ["foo"],
    };
    const res3 = formatErrorMessage(reason3);
    expect(res3).toBe("Template 'foo'");


    const reason4: InvalidFieldReason = {
      message: "Expected {...} got {...}",
      args: ["foo", "bar"],
    };
    const res4 = formatErrorMessage(reason4);
    expect(res4).toBe("Expected 'foo' got 'bar'");


    settings({
      i18n: i18nRU
    });
    const res1RU = formatErrorMessage(reason1);
    expect(res1RU).toBe("Плохой запрос");
    const res2RU = formatErrorMessage(reason2,);
    expect(res2RU).toBe("Missing i18n");
    const res3RU = formatErrorMessage(reason3);
    expect(res3RU).toBe("Шаблон 'foo'");
    const res4RU = formatErrorMessage(reason4);
    expect(res4RU).toBe("Expected 'foo' got 'bar'");
  });


  test("Errors throws", async () => {
    const request: APIRequest = { method: "test", args: {} };
    const rules: APIValidationObject = { test: z.object({}) };
    const fn1 = async () => {
      throw new ResponseError("Test throw");
    }
    // debugger;
    const result1 = await validate(request, rules, { test: fn1 });

    expect(result1[1].status).toBe(400);
    expect(result1[0].message).toBe("Test throw");

    const fn2 = async () => {
      throw new ResponseError({
        message: "Test throw {...}",
        args: ["2"],
      });
    }
    const result2 = await validate(request, rules, { test: fn2 });

    const invalidMessage2 = formatErrorMessage(result2[0]);
    expect(invalidMessage2).toBe("Test throw '2'");


    const fn3 = async () => {
      throw new ResponseError({
        invalidFields: {
          test: {
            message: "Test throw {...}",
            args: ["3"],
          }
        },
        statusCode: 401
      });
    }
    const result3 = await validate(request, rules, { test: fn3 });

    const invalidMessage3 = formatErrorMessage(result3[0].invalidFields.test);
    expect(invalidMessage3).toBe("Test throw '3'");
    expect(result3[0].message).toBe("Following fields contains errors: test");
    expect(result3[1].status).toBe(401);


    const fn4 = async () => {
      throw new ResponseError("username", "Required", []);
    }
    const result4 = await validate(request, rules, { test: fn4 });

    expect(result4[0].invalidFields.username.message).toBe("Required");
  });


});