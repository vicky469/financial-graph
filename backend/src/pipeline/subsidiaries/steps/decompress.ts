/**
 * Decompress Step
 *
 * Reads and decompresses .htm.gz files to HTML strings.
 */

import fs from "fs/promises";
import { gunzip } from "zlib";
import { promisify } from "util";
import { Step } from "../../core/types";
import { SECFilingTarget } from "../../sources/types";
import { DecompressedFiling } from "../types";

const gunzipAsync = promisify(gunzip);

export const decompressStep: Step<SECFilingTarget, DecompressedFiling> = {
  name: "decompress",

  async execute(target, context) {
    const compressedData = await fs.readFile(target.cachePath);
    const decompressed = await gunzipAsync(compressedData);
    const html = decompressed.toString("utf-8");

    return {
      ...target,
      html,
    };
  },
};
