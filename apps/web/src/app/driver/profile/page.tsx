'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { PageHeader, SkeletonTable, ErrorBox } from '@/components/ui';
import { cn } from '@/lib/cn';

type Me = {
  fullName: string;
  email: string;
  driver: {
    publicId: string;
    phone: string;
    company: string | null;
    vehicles: Array<{ plate: string; type: string; active: boolean }>;
  } | null;
};

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Me>('/auth/me')
      .then(setMe)
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonTable rows={4} />;
  if (!me || !me.driver) return <ErrorBox message={error ?? 'Profile unavailable'} />;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        eyebrow="My account"
        title="Profile"
        description="To change contact details (name, phone, email), visit reception. We keep these read-only to prevent account hijacking."
      />

      <div className="panel-strong p-6 space-y-4">
        <Row label="Driver ID" value={me.driver.publicId} mono />
        <Row label="Full name" value={me.fullName} />
        <Row label="Email" value={me.email} />
        <Row label="Phone" value={me.driver.phone} mono />
        <Row label="Company" value={me.driver.company ?? '—'} />
      </div>

      <div className="panel-strong p-6">
        <h2 className="font-display text-lg">Vehicles</h2>
        <div className="mt-3 space-y-2">
          {me.driver.vehicles.map((v) => (
            <div key={v.plate} className="rounded-lg bg-bg-elevated/60 ring-1 ring-bg-ring p-3 flex items-center justify-between">
              <div>
                <div className="font-mono">{v.plate}</div>
                <div className="text-[11px] text-text-muted">{v.type}</div>
              </div>
              <span className={cn('pill', v.active ? 'pill-online' : 'pill-offline')}>
                {v.active ? 'active' : 'inactive'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 text-sm">
      <div className="text-text-secondary">{label}</div>
      <div className={cn(mono && 'font-mono')}>{value}</div>
    </div>
  );
}
