export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(process.env.SHEET_URL);
    if (!response.ok) throw new Error(`Sheet fetch failed: ${response.status}`);

    const text = await response.text();
    const prices = {};

    const rows = text.trim().split('\n').slice(1); // skip header
    for (const row of rows) {
      const comma = row.indexOf(',');
      if (comma === -1) continue;
      const sym = row.slice(0, comma).trim();
      const price = parseFloat(row.slice(comma + 1).trim());
      if (sym && !isNaN(price)) prices[sym] = price;
    }

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
    return res.status(200).json(prices);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch prices' });
  }
}
