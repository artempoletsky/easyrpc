
## About The Project

EasyRPC is a library for implementing Remote Procedure Call pattern in Typescript. 
Write methods on the server and call them on the client like AJAX doesn't even exists. 
As well EasyRPC provides powerful, declarative and extendable API for data validation.

The librarty is designed to work with next.js but you can use it anywhere.

## Installation

```console
npm install --save @artempoletsky/easyrpc
```

## Basic usage

This examples are provided for a next.js route

```typescript
// route.ts

import { NextRequest, NextResponse } from "next/server";
import validate, { ValidationRule } from "@artempoletsky/easyrpc";

// at first declare a type for the method argumetns
// the naming prefix `T` stands for Type. You can use your own naming conventions.
type TMyMethod = {
  num: number
  str: string
  array: number[]
  etc: any
}

// then declare a validation rules object. It basically repeats your argument type above in trivial cases. But it can be extened for complex cases. 
// the naming prefix `V` stands for Validation
const VMyMethod: ValidationRule<TMyMethod> = {
  num: "number", //function `validate` will return 400 error if the given parameter is not a number
  str: "string", //... error if the given parameter is not a string
  array: "number[]", //... error if the given parameter is not an array of numbers
  etc: "any", // function `validate` won't validate this parameter
}

//then implement your method 
async function myMethod({ num, str, array, etc }: TMyMethod){
  // function `validate` will ensure that all args are valid here
  return "Hello RPC!"; // send this as a responce to the client
}

// export the method signature as a type for using on the client
// the naming prefix `M` stands for Method
export type MMyMethod = typeof myMethod;

// next.js API route implementation
export async function POST(req: NextRequest) {
  // get method and arguments from the request
  let { method, args } = await req.json();


  let [result, statusObject] = await validate(
    { // pass the arguments and the method name
      method, // "myMethod"
      args, // args is TMyMethod if valid
    },
    {
      myMethod: VMyMethod, // pass here all of your rules for all of your methods
    },
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
import type { MMyMethod } from "../path/to/your/api/route";

const myMethod = getAPIMethod<MMyMethod>("http_path/to/your_route", "myMethod");

export default function Page() {
  function onClick(){
    //call it with the signature defined on the server
    myMethod({
      num: 1,
      str: "Hello!",
      array: [1, 2, 3],
      etc: null,
    })
      .then(console.log); // prints "Hello RPC!" to the browser's console
  }
  return (
   <button onClick={onClick}>Call my method!</button>
  )
}
```


<!-- CONTACT -->
## Contact

Your Name - [@twitter_handle](https://twitter.com/twitter_handle) - email@email_client.com

Project Link: [https://github.com/github_username/repo_name](https://github.com/github_username/repo_name)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

