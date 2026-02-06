import fs from "node:fs/promises";
import path from "node:path";

interface WriteJsonMetaParams<T> {
  filePath: string;
  source: string;
  data: T;
  notes?: any;
}

export async function writeJsonWithMeta<T>({
  filePath,
  source,
  data,
  notes,
}: WriteJsonMetaParams<T>): Promise<{
  meta: {
    records: number;
    fileSize: string;
    notes?: any;
  };
}> {
  const records = Array.isArray(data)
    ? data.length
    : typeof data === "object" && data !== null
      ? Object.keys(data as object).length
      : 1;

  const basePayload = {
    meta: {
      records,
      fileSize: "", // placeholder, set after serialization
      notes,
    },
    data,
  };

  // First pass to measure size
  const jsonWithPlaceholder = JSON.stringify(basePayload, null, 2);
  const fileSizeBytes = Buffer.byteLength(jsonWithPlaceholder);
  const fileSize = formatBytes(fileSizeBytes);

  const payload = {
    ...basePayload,
    meta: { ...basePayload.meta, fileSize },
  };

  const finalJson = JSON.stringify(payload, null, 2);

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.unlink(filePath).catch(() => {});
  await fs.writeFile(filePath, finalJson, { encoding: "utf-8", flag: "w" });

  return { meta: payload.meta };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}
