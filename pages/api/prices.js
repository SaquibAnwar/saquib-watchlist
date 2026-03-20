export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { SHEETS_SPREADSHEET_ID, GOOGLE_API_KEY } = process.env;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_SPREADSHEET_ID}/values/Sheet1!A:B?key=${GOOGLE_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Sheets API failed: ${response.status}`);

    const data = await response.json();
    const rows = data.values ?? [];
    const prices = {};

    for (const [sym, price] of rows.slice(1)) { // skip header
      const parsed = parseFloat(price);
      if (sym && !isNaN(parsed)) prices[sym.trim()] = parsed;
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(prices);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch prices' });
  }
}
