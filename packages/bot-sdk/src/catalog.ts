import {
  createCatalogEntriesForFormat,
  starterFormat,
} from "@lunchtable/card-content";
import type { CardCatalogEntry } from "@lunchtable/shared-types";

const starterCatalog = createCatalogEntriesForFormat(starterFormat);

export function getCatalogForFormat(formatId: string): CardCatalogEntry[] {
  if (formatId === starterFormat.formatId) {
    return starterCatalog;
  }

  return [];
}
