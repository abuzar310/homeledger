const PAGE = 1000;

/**
 * Runs a range query page by page, because the API returns at most 1,000 rows per request.
 * `page` must build a fresh query with a stable order (end with `.order("id")`) for each range.
 */
export async function allPages(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let start = 0; ; start += PAGE) {
    const { data, error } = await page(start, start + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}
