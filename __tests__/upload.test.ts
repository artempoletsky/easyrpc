import { createUploadFormData, packUploadArguments } from "../client";


describe("Upload methods", () => {
  const f = new File([], "test");

  test("packUploadArguments", () => {
    let r = packUploadArguments({
      file: f,
    });
    expect(r.files.length).toBe(1);
    expect(r.filePaths).toBe(`["file"]`);
    expect(r.args).toBe(`{"file":"file[0]"}`);

    r = packUploadArguments({
      files: [f, f, f],
      test: "foo",
    });
    expect(r.files.length).toBe(3);
    expect(r.filePaths).toBe(`["files/0","files/1","files/2"]`);
    expect(r.args).toBe(`{"files":["file[0]","file[1]","file[2]"],"test":"foo"}`);
    r = packUploadArguments({
      files: [
        { id: 0, file: f, },
        { id: 1, file: f, },
        { id: 2, file: f, },
        { id: 3, file: f, },
      ]
    });
    expect(r.files.length).toBe(4);
    expect(r.filePaths).toBe(`["files/0/file","files/1/file","files/2/file","files/3/file"]`);
    expect(r.args).toBe(`{"files":[{"id":0,"file":"file[0]"},{"id":1,"file":"file[1]"},{"id":2,"file":"file[2]"},{"id":3,"file":"file[3]"}]}`);
  });

  test("createUploadFormData", () => {
    let fd = createUploadFormData({
      files: [
        { id: 0, file: f, },
        { id: 1, file: f, },
        { id: 2, file: f, },
        { id: 3, file: f, },
      ]
    });

    expect(fd.getAll("files").length).toBe(4);
    expect(fd.get("args")).toBe(`{"files":[{"id":0,"file":"file[0]"},{"id":1,"file":"file[1]"},{"id":2,"file":"file[2]"},{"id":3,"file":"file[3]"}]}`);
    expect(fd.get("filePaths")).toBe(`["files/0/file","files/1/file","files/2/file","files/3/file"]`);
  })
});