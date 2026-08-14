import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch ALL rows from a Supabase table, bypassing the default 1000-row limit.
 * Uses range-based pagination to fetch in batches.
 *
 * @param table - Table name
 * @param select - Select columns (default "*")
 * @param filters - A function that receives the query builder and applies filters
 * @param orderBy - Optional order column (default "created_at")
 * @param ascending - Order direction (default false = newest first)
 * @param pageSize - Rows per page (default 1000)
 */
export async function fetchAllRows(
  table: string,
  select: string = "*",
  filters?: (query: any) => any,
  orderBy?: string,
  ascending: boolean = false,
  pageSize: number = 1000
): Promise<any[]> {
  const allRows: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = (supabase as any).from(table).select(select);

    if (filters) {
      query = filters(query);
    }

    if (orderBy) {
      query = query.order(orderBy, { ascending });
    }

    query = query.range(from, from + pageSize - 1);

    const { data, error } = await query;

    if (error) {
      console.error(`fetchAllRows error on ${table}:`, error);
      break;
    }

    if (data && data.length > 0) {
      allRows.push(...data);
      from += data.length;
      // If we got fewer rows than pageSize, there are no more rows
      if (data.length < pageSize) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  return allRows;
}
