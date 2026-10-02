import { describe, expect, it } from "vitest";
import { strToU8, unzipSync } from "fflate";
import { ZipBlobWriter, isZipFile, readZipEntries, readZipJson } from "./zip";

describe("zip", () => {
  it("round-trips stored and deflated entries", async () => {
    const photo = new Uint8Array(4096).map((_, i) => (i * 31) % 251);
    const writer = new ZipBlobWriter();
    writer.addFile("media/journal-photos/u/a.jpg", photo);
    writer.addJson("backup.json", { hello: "wörld", n: [1, 2, 3] });
    const blob = await writer.finish();

    expect(await isZipFile(blob)).toBe(true);
    const entries = await readZipEntries(blob);
    expect([...entries.keys()].sort()).toEqual([
      "backup.json",
      "media/journal-photos/u/a.jpg",
    ]);
    expect(await entries.get("media/journal-photos/u/a.jpg")!.read()).toEqual(
      photo
    );
    expect(await readZipJson(entries.get("backup.json")!)).toEqual({
      hello: "wörld",
      n: [1, 2, 3],
    });
  });

  it("writes archives other zip readers understand", async () => {
    const writer = new ZipBlobWriter();
    writer.addFile("a.txt", strToU8("plain"));
    const files = unzipSync(
      new Uint8Array(await (await writer.finish()).arrayBuffer())
    );
    expect(new TextDecoder().decode(files["a.txt"])).toBe("plain");
  });

  it("does not mistake JSON for a zip", async () => {
    expect(await isZipFile(new Blob(['{"version":4}']))).toBe(false);
  });
});
