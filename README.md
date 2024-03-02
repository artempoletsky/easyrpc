
## About The Project

EasyRPC is a library for implementing Remote Procedure Call pattern in Typescript. 

Key features: 

- Zero learning curve. If you know how to use Javascript asynchronous functions you know how to use this library.
- Write methods on the server and call them on the client like AJAX doesn't even exist. 
- Minimum boilerplate.  
- Convenient error handling.
- Supports templates for error messages and i18n.


It uses [zod](https://github.com/colinhacks/zod) for data validation.

EasyRPC is framework agnostic but it has some useful methods for working with Next.js and Mantine.

## Installation

```console
npm install --save @artempoletsky/easyrpc
```

## Basic usage

Thess examples are provided for a Next.js route

First create a new directory for a new Next API route. Create 2 files inside it: `schemas.ts` and `route.ts`.

`schemas.ts ` contains validation rules for your API methods. 

It's recommended to create it if you want to use `zod` for validation on the client. This way you can use same validation rules on both the client and the server.
```typescript
// schemas.ts

import z from "zod";

//myMethod is exact name of your method
export const myMethod = z.object({
  num: z.number(),
  num: z.string(),
  array: z.array(z.number()),
  etc: z.any(),
});

// the naming prefix `A` stands for Argument. You can use your own naming conventions.
export type AMyMethod = z.infer<typeof myMethod>;

// ... export other methods this way
```

Next.js route:
```typescript
// route.ts

import { NextResponse } from "next/server";
import validate, { NextPOST, ResponseError } from "@artempoletsky/easyrpc";
import * as schemas from "./schemas";
import type { AMyMethod } from "./schemas";

//implement your method 
async function myMethod({ num, str, array, etc }: AMyMethod){
  // zod will ensure that all args are valid here

  // send 400 error to the client
  if (false) throw new ResponseError("Bad request");

  // send 400 error to the client and tell that a specific form field caused it
  if (false) throw new ResponseError("fieldName", "Bad field");

  if (false) throw new Error("Something got wrong"); // 500 error

  return "Hello RPC!"; // send this as a responce to the client
}

// export the method signature as a type for using on the client
// the naming prefix `F` stands for Function
export type FMyMethod = typeof myMethod;

//  the shortcut `NextPOST` function that creates a POST function for you
export const POST = NextPOST(NextResponse, schemas, {
  myMethod,
});
```

Also you can implement the POST method yourself if you want a more fine tuned behavior. Use validate function for that.

```typescript

import validate from "@artempoletsky/easyrpc";

// next.js API route implementation
export async function POST(req: NextRequest) {
  // get method and arguments from the request
  let { method, args } = await req.json();


  let [result, statusObject] = await validate(
    { // pass the arguments and the method name
      method, // "myMethod"
      args, // args is TMyMethod if valid
    },
    schemas,
    {
      myMethod, // pass here all of your methods 
    }
  );
  // `result`` is "Hello RPC!" if args is valid
  // `statusObject` is { status: 200 } if args is valid
  // if the method name doesn't exist or `args` is invalid `validate` will return 400 and the error message
  return NextResponse.json(result, statusObject);
}
```

The client code:
```tsx
// some_client_code.tsx

import { getAPIMethod } from "@artempoletsky/easyrpc/client";
import type { FMyMethod } from "../path/to/your/api/route";

const myMethod = getAPIMethod<FMyMethod>("http_path/to/your_route", "myMethod");

export default function Page() {
  const [setRequestError, mainErrorMessage] = useErrorResponse();

  function onClick(){
    //clear errors before request
    setRequestError();
    //call it with the signature defined on the server
    myMethod({
      num: 1,
      str: "Hello!",
      array: [1, 2, 3],
      etc: null,
    })
      .then(console.log) // prints "Hello RPC!" to the browser's console
      .catch(setRequestError); // catch errors
  }
  return (
   <button onClick={onClick}>Call my method!</button>
   <div>{mainErrorMessage}</div>
  )
}
```

When throwng `ResponseError` you can customize the error code, error fields and send custom info to the client.
```typescript
  if (false) throw new ResponseError({
    message: "Bad request",
    statusCode: 403,

    invalidFields: {
      num: {
        message: "Invalid",
        args: []
      },
      str: {
        message: "Invalid",
        args: []
      }
    },

        payload: {
      some: "custom info",
    },
  });
```


Using with [@manine/form](https://mantine.dev/form/use-form/)


```tsx


import { getAPIMethod } from "@artempoletsky/easyrpc/client";
import { useForm } from '@mantine/form';

import type { FAuthorize } from "../path/to/your/api/route";

// import your zod schemas for Mantine form
import { AAuthorize, authorize as ZAuthorize } from "../path/to/your/api/schemas";

const authorize = getAPIMethod<FAuthorize>("http_path/to/your_route", "authorize");

export default function Page() {
  const form = useForm<AAuthorize>({
    initialValues: {
      userName: "",
      password: "",
    },
    validate: zodResolver(ZAuthorize), // validates on the client
  });

  const [setRequestError, mainErrorMessage] = useErrorResponse(form); // pass a Mantine form

  function onAutorize({ userName, password }: AAuthorize) {
    setRequestError();
    authorize({ userName, password })
      .then(() => {
        // reloading the page
        window.location.href += "";
      })
      .catch(setRequestError);
  }
  
  return (
    <form onSubmit={form.onSubmit(onAutorize)}>
      <TextInput
        {...form.getInputProps("userName")} // the magic will handle all field errors for you
        placeholder="username"
      />
      <TextInput
        {...form.getInputProps("password")} // the magic will handle all field errors for you
        placeholder="password" type="password" />
      <Button type="submit">Login</Button>
      <div>{mainErrorMessage}</div>
    </form>
  )
}
```

