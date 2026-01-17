/**
 * Limit Filter
 *
 * Limits the number of items to process.
 * Useful for testing and debugging.
 */

import { Filter } from "../../core/types";

export class LimitFilter<T> implements Filter<T> {
  name: string;

  constructor(private limit: number) {
    this.name = `limit(${limit})`;
  }

  apply(items: T[]): T[] {
    return items.slice(0, this.limit);
  }
}
