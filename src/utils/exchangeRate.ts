import { useAppStore } from '../stores/useAppStore';

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Refreshes settings.aedToInrRate at most once per REFRESH_INTERVAL_MS,
// tracked via settings.rateFetchedAt. Call on every app load (not just
// login) so long-lived sessions still get a fresh rate periodically.
export const maybeRefreshExchangeRate = async () => {
  const { settings, updateSettings, setRateJustUpdated } = useAppStore.getState();
  const fetchedAt = settings.rateFetchedAt ? new Date(settings.rateFetchedAt).getTime() : 0;
  if (Date.now() - fetchedAt < REFRESH_INTERVAL_MS) return;

  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/AED');
    const data = await response.json();
    if (data.rates?.INR) {
      await updateSettings({ aedToInrRate: data.rates.INR, rateFetchedAt: new Date().toISOString() });
      setRateJustUpdated(true);
    }
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
  }
};
