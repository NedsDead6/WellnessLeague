const PAGE_SIZE = 1000; // Supabase returns at most 1,000 rows per request.

type Page = PromiseLike<{ data: any[] | null; error: { message: string } | null }>;

/** Reads every row of a query by asking for it one page at a time. */
export async function fetchAll(page: (from: number, to: number) => Page): Promise<any[]> {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}
