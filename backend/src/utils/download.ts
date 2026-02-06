import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createLogger } from "./logger";

const execFileAsync = promisify(execFile);
const logger = createLogger("utils/download");

export async function downloadFile(
  url: string,
  destPath: string,
  headers?: Record<string, string>,
): Promise<void> {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, buffer);
}

export async function unzipFile(
  zipPath: string,
  destDir: string,
): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  await execFileAsync("unzip", ["-oq", zipPath, "-d", destDir]);
}

type DownloadAndUnzipBaseOptions = {
  url: string;
  destDir: string; // where files will be unzipped
  headers?: Record<string, string>;
  zipName?: string; // optional override for zip filename
  zipDir?: string; // optional directory to store the zip; defaults to destDir
};

type DownloadAndUnzipWithCheckOptions = DownloadAndUnzipBaseOptions & {
  skipIf: (entries: string[]) => boolean;
};

export async function downloadAndUnzip(
  options: DownloadAndUnzipBaseOptions | DownloadAndUnzipWithCheckOptions,
): Promise<{
  skipped: boolean;
  zipPath: string;
}> {
  const { url, destDir, headers, zipName } = options;
  const skipIf = "skipIf" in options ? options.skipIf : undefined;

  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(destDir).catch(() => []);

  const zipDir = "zipDir" in options && options.zipDir ? options.zipDir : destDir;
  await fs.mkdir(zipDir, { recursive: true });

  const zipPath = zipName ?? path.basename(url);

  const shouldSkip = skipIf ? skipIf(entries) : entries.length > 0;

  if (shouldSkip) {
    logger.info("Download skipped (already have entries)", {
      destDir,
      zipPath: path.join(destDir, zipPath),
      entries: entries.length,
    });
    return { skipped: true, zipPath: path.join(destDir, zipPath) };
  }

  const fullZipPath = path.join(zipDir, zipPath);

  logger.info("Downloading submissions zip", { url, path: fullZipPath });
  await downloadFile(url, fullZipPath, headers);
  logger.info("Download complete, starting unzip", { zipPath: fullZipPath, destDir });
  await unzipFile(fullZipPath, destDir);
  logger.info("Unzip complete", { zipPath: fullZipPath, destDir });

  return { skipped: false, zipPath: fullZipPath };
}
