import { notFound } from 'next/navigation';
import { API_BASE_URL, API_PREFIX } from '@/lib/env';
import MonitorClient from './monitor-client';

type Gate = {
  id: string;
  code: string;
  name: string;
  direction: 'ENTRY' | 'EXIT' | 'BIDIRECTIONAL';
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
  zone: string | null;
  capacity: number;
  occupancy: number;
};

async function fetchGate(code: string): Promise<Gate | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${API_PREFIX}/gates/public/${encodeURIComponent(code)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as Gate;
  } catch {
    return null;
  }
}

export default async function MonitorPage({ params }: { params: { code: string } }) {
  const gate = await fetchGate(params.code);
  if (!gate) notFound();
  return <MonitorClient gate={gate} />;
}
