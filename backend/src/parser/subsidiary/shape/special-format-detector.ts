import * as cheerio from "cheerio";
type CheerioAPI = ReturnType<typeof cheerio.load>;

import { createLogger } from "../../../utils/logger";
import { DocumentClassification } from "../parser-types";

const logger = createLogger("parsers/subsidiary/special-format-detector");

const GENERIC_IMAGE_FILENAME =
  /^(?:image|img|scan|figure)[_\-\d]*\.(jpg|jpeg|png|gif)$/i;

export type SpecialFormatClassification =
  | DocumentClassification.IMAGE_BASED
  | DocumentClassification.PDF_BASED;

export function detectSpecialFormats(
  $: CheerioAPI,
): SpecialFormatClassification | null {
  if (hasPdfEmbed($)) {
    return DocumentClassification.PDF_BASED;
  }

  if (hasSubstantialImage($)) {
    return DocumentClassification.IMAGE_BASED;
  }

  return null;
}

function hasSubstantialImage($: CheerioAPI): boolean {
  let found = false;

  $("img").each((_: number, img: any) => {
    if (found) return false;

    const $img = $(img);
    const alt = ($img.attr("alt") || "").toLowerCase();
    const src = ($img.attr("src") || "").toLowerCase();
    const fileName = src.split("/").pop() || src;
    const style = $img.attr("style") || "";

    const width = parseInt($img.attr("width") || "0", 10);
    const height = parseInt($img.attr("height") || "0", 10);
    const styleWidth = parseInt(style.match(/width:\s*(\d+)px/i)?.[1] || "0", 10);
    const styleHeight = parseInt(
      style.match(/height:\s*(\d+)px/i)?.[1] || "0",
      10,
    );

    const actualWidth = Math.max(width, styleWidth);
    const actualHeight = Math.max(height, styleHeight);

    const hasRelevantName =
      alt.includes("exhibit") ||
      alt.includes("subsidiary") ||
      src.includes("exhibit") ||
      src.includes("subsidiary") ||
      GENERIC_IMAGE_FILENAME.test(fileName);

    const isSubstantial = actualWidth > 200 || actualHeight > 200;

    if (hasRelevantName || isSubstantial) {
      found = true;
      logger.debug(
        `Found substantial image: src="${src}", alt="${alt}", dimensions=${actualWidth}x${actualHeight}`,
      );
      return false;
    }
  });

  return found;
}

function hasPdfEmbed($: CheerioAPI): boolean {
  let found = false;

  $("embed, object, iframe").each((_: number, element: any) => {
    if (found) return false;

    const $element = $(element);
    const src = ($element.attr("src") || "").toLowerCase();
    const data = ($element.attr("data") || "").toLowerCase();
    const type = ($element.attr("type") || "").toLowerCase();

    if (src.includes(".pdf") || data.includes(".pdf") || type.includes("pdf")) {
      found = true;
      logger.debug(`Found PDF embed: src="${src}", data="${data}", type="${type}"`);
      return false;
    }
  });

  return found;
}
