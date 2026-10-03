import { Zip, ZipDeflate, ZipPassThrough, inflateSync, strToU8 } from "fflate";

function toBlobPart(chunk: Uint8Array): BlobPart {
  return chunk as Uint8Array<ArrayBuffer>;
}

/**
 * Builds a zip one file at a time. Each finished chunk moves into a Blob right
 * away, so the archive never has to exist as one large array in memory.
 */
export class ZipBlobWriter {
  private readonly parts: Blob[] = [];
  private readonly zip: Zip;
  private readonly finished: Promise<void>;
  private failure: Error | null = null;

  constructor() {
    let resolve!: () => void;
    let reject!: (err: Error) => void;
    this.finished = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.zip = new Zip((err, chunk, final) => {
      if (err) {
        this.failure = err;
        reject(err);
        return;
      }
      if (chunk.length > 0) this.parts.push(new Blob([toBlobPart(chunk)]));
      if (final) resolve();
    });
  }

  /** Photos and videos are already compressed, so they are stored as-is. */
  addFile(name: string, data: Uint8Array, options?: { compress?: boolean }) {
    if (this.failure) throw this.failure;
    const entry = options?.compress
      ? new ZipDeflate(name, { level: 6 })
      : new ZipPassThrough(name);
    this.zip.add(entry);
    entry.push(data, true);
  }

  addJson(name: string, value: unknown) {
    this.addFile(name, strToU8(JSON.stringify(value)), { compress: true });
  }

  async finish(): Promise<Blob> {
    this.zip.end();
    await this.finished;
    return new Blob(this.parts, { type: "application/zip" });
  }
}

class ZipReadError extends Error {}

export interface ZipEntry {
  name: string;
  read(): Promise<Uint8Array>;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

async function readBytes(blob: Blob, start: number, end: number) {
  return new Uint8Array(await blob.slice(start, end).arrayBuffer());
}

export async function isZipFile(blob: Blob): Promise<boolean> {
  if (blob.size < 4) return false;
  const head = new DataView((await readBytes(blob, 0, 4)).buffer);
  return head.getUint32(0, true) === LOCAL_SIGNATURE;
}

/**
 * Lists a zip's files from its central directory. Entry data is sliced from
 * the Blob on demand, so a large clips archive is never read whole.
 */
export async function readZipEntries(
  blob: Blob
): Promise<Map<string, ZipEntry>> {
  const tailStart = Math.max(0, blob.size - 65_557);
  const tail = await readBytes(blob, tailStart, blob.size);
  const tailView = new DataView(tail.buffer);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i -= 1) {
    if (tailView.getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipReadError("Not a zip archive");

  const count = tailView.getUint16(eocd + 10, true);
  const dirSize = tailView.getUint32(eocd + 12, true);
  const dirOffset = tailView.getUint32(eocd + 16, true);
  if (dirOffset === 0xffffffff || dirSize === 0xffffffff) {
    throw new ZipReadError("Zip64 archives are not supported");
  }

  const dir = await readBytes(blob, dirOffset, dirOffset + dirSize);
  const view = new DataView(dir.buffer);
  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntry>();
  let pos = 0;
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(pos, true) !== CENTRAL_SIGNATURE) {
      throw new ZipReadError("Corrupt zip directory");
    }
    const method = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const localOffset = view.getUint32(pos + 42, true);
    const name = decoder.decode(dir.subarray(pos + 46, pos + 46 + nameLength));
    pos += 46 + nameLength + extraLength + commentLength;

    if (method !== METHOD_STORED && method !== METHOD_DEFLATE) {
      throw new ZipReadError(`Unsupported zip compression (${method})`);
    }
    entries.set(name, {
      name,
      async read() {
        const header = new DataView(
          (await readBytes(blob, localOffset, localOffset + 30)).buffer
        );
        if (header.getUint32(0, true) !== LOCAL_SIGNATURE) {
          throw new ZipReadError("Corrupt zip entry");
        }
        const start =
          localOffset +
          30 +
          header.getUint16(26, true) +
          header.getUint16(28, true);
        const data = await readBytes(blob, start, start + compressedSize);
        return method === METHOD_DEFLATE ? inflateSync(data) : data;
      },
    });
  }
  return entries;
}

export async function readZipJson(entry: ZipEntry): Promise<unknown> {
  return JSON.parse(new TextDecoder().decode(await entry.read()));
}
