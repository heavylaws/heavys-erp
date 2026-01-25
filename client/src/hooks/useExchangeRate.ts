import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface CurrencyRate {
  id?: string;
  fromCurrency: string;
  toCurrency: string;
  rate: string | number;
  updatedBy?: string;
  updatedAt?: string;
  createdAt?: string;
}

async function fetchCurrentRate(): Promise<CurrencyRate | null> {
  const res = await fetch('/api/currency/current', { credentials: 'include' });
  if (!res.ok) return null;
  return res.json();
}

async function fetchHistory(limit = 5): Promise<CurrencyRate[]> {
  const res = await fetch(`/api/currency/history?limit=${limit}`, { credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}

interface UpdateRateInput { rate: number | string; fromCurrency?: string; toCurrency?: string; }

async function updateRate(input: UpdateRateInput): Promise<CurrencyRate> {
  const res = await fetch('/api/currency/update', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Failed to update exchange rate');
  }
  return res.json();
}

export function useExchangeRate() {
  const qc = useQueryClient();
  const currentQuery = useQuery({ queryKey: ['currency', 'current'], queryFn: fetchCurrentRate, staleTime: 60_000 });
  const historyQuery = useQuery({ queryKey: ['currency', 'history', 5], queryFn: () => fetchHistory(5), staleTime: 60_000 });

  const mutation = useMutation({
    mutationFn: updateRate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['currency'] });
    }
  });

  const rate = currentQuery.data?.rate ? Number(currentQuery.data.rate) : 1;
  const primaryCurrency = currentQuery.data?.fromCurrency || 'USD';
  const secondaryCurrency = currentQuery.data?.toCurrency || 'LBP';

  return {
    ...currentQuery,
    rate,
    primaryCurrency,
    secondaryCurrency,
    history: historyQuery.data || [],
    updateRate: mutation.mutateAsync,
    updating: mutation.isPending,
    updateError: mutation.error
  };
}
