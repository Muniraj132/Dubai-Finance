// mfapi.in wraps the official AMFI daily NAV file as free, CORS-open JSON —
// no API key, callable directly from the browser, same as the AED/INR
// exchange rate fetch in exchangeRate.ts. See docs/ARCHITECTURE.md §7.10.

export interface MfSchemeSearchResult {
  schemeCode: number;
  schemeName: string;
}

export interface MfNav {
  nav: number;
  date: string;
}

export const searchMfSchemes = async (query: string): Promise<MfSchemeSearchResult[]> => {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error('Error searching MF schemes:', error);
    return [];
  }
};

export const fetchLatestNav = async (schemeCode: number): Promise<MfNav | null> => {
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
    if (!res.ok) return null;
    const data = await res.json();
    const latest = data?.data?.[0];
    if (!latest?.nav) return null;
    return { nav: parseFloat(latest.nav), date: latest.date };
  } catch (error) {
    console.error('Error fetching MF NAV:', error);
    return null;
  }
};
