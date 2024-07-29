import { createUploadFormData, packUploadArguments } from "../client";
import { setByPath } from "../rpc";


describe("RPC", () => {
  const f = new File([], "test");

  test("setByPath", () => {
    let obj = {
      files: [
        { id: 0, file: "file[0]", },
        { id: 1, file: "file[1]", },
        { id: 2, file: "file[2]", },
        { id: 3, file: "file[3]", },
      ]
    }

    expect(() => {
      setByPath(obj, ["foo", "bar"], 1);
    }).toThrow();

    setByPath(obj, ["files", "1", "file"], 1);
    expect(obj.files[1].file).toBe(1);
  });

});