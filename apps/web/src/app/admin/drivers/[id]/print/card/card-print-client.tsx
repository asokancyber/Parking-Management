'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api, errorMessage } from '@/lib/api';

type Driver = {
  publicId: string;
  fullName: string;
  company: string | null;
  vehicles: Array<{ plate: string; type: string }>;
  subscriptions: Array<{ planName: string; expiresAt: string; status: string }>;
  cards: Array<{ uid: string; label: string | null; status: string }>;
};

// Printable RFID card layout. Roughly credit-card sized (85.6mm × 53.98mm =
// ISO/IEC 7810 ID-1). The screen view shows it framed; the print stylesheet
// strips the chrome.
export default function CardPrintClient({ id }: { id: string }) {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    api<Driver>(`/drivers/${id}`)
      .then(async (d) => {
        setDriver(d);
        const activeCard = d.cards.find((c) => c.status === 'ACTIVE') ?? d.cards[0];
        const verifyPayload = JSON.stringify({
          v: 1,
          driver: d.publicId,
          plate: d.vehicles[0]?.plate ?? '',
          card: activeCard?.uid ?? '',
          issued: new Date().toISOString(),
        });
        const url = await QRCode.toDataURL(verifyPayload, { width: 240, margin: 0 });
        setQr(url);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [id]);

  if (error) return <div className="p-10 text-rose-300">{error}</div>;
  if (!driver) return <div className="p-10 text-text-muted">Loading…</div>;

  const vehicle = driver.vehicles[0];
  const sub = driver.subscriptions[0];
  const card = driver.cards.find((c) => c.status === 'ACTIVE') ?? driver.cards[0];

  return (
    <>
      <PrintStyles />
      <div className="min-h-screen bg-bg-base text-text-primary p-8 flex flex-col items-center gap-6 print:bg-white print:text-black print:p-0 print:items-start">
        {/* Print button (hidden on print) */}
        <div className="print:hidden flex gap-3">
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-gradient-to-r from-accent-cyan to-accent-violet px-5 py-2.5 text-sm font-medium text-black/90"
          >
            🖨 Print card
          </button>
          <button
            onClick={() => window.close()}
            className="rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-4 py-2.5 text-sm"
          >
            Close
          </button>
        </div>

        {/* The card */}
        <div className="card-print">
          <div className="card-inner">
            <div className="card-header">
              <div className="brand">PARKSPHERE</div>
              <div className="brand-sub">ENTERPRISE</div>
            </div>

            <div className="card-body">
              <div className="left">
                <div className="label">Driver</div>
                <div className="value name">{driver.fullName}</div>

                <div className="label mt-3">Vehicle</div>
                <div className="value mono">{vehicle?.plate ?? '—'}</div>

                <div className="label mt-3">Driver ID</div>
                <div className="value mono small">{driver.publicId}</div>

                {sub && (
                  <>
                    <div className="label mt-3">Valid until</div>
                    <div className="value small">
                      {new Date(sub.expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </>
                )}
              </div>
              <div className="right">
                {qr && <img src={qr} alt="verify QR" className="qr" />}
                <div className="uid mono">{card?.uid ?? '—'}</div>
              </div>
            </div>

            <div className="card-footer">
              {driver.company ?? '—'} · Issued {new Date().toLocaleDateString('en-GB')}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── CSS-in-JSX so this page is self-contained ────────────────────────
function PrintStyles() {
  return (
    <style jsx global>{`
      .card-print {
        width: 340px;      /* approx 85.6mm at 96dpi */
        height: 215px;     /* approx 53.98mm */
        background: linear-gradient(135deg, #0a0e1a 0%, #1a1538 100%);
        border-radius: 14px;
        box-shadow: 0 30px 80px -20px rgba(34, 225, 255, 0.25);
        color: #e9edf7;
        position: relative;
        overflow: hidden;
      }
      .card-print::before {
        content: '';
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 0% 0%, rgba(34, 225, 255, 0.15), transparent 40%),
          radial-gradient(circle at 100% 100%, rgba(124, 92, 255, 0.18), transparent 40%);
      }
      .card-inner {
        position: relative;
        padding: 14px 16px;
        height: 100%;
        display: flex;
        flex-direction: column;
        font-family: -apple-system, 'Segoe UI', sans-serif;
      }
      .card-header { display: flex; justify-content: space-between; align-items: baseline; }
      .brand { font-weight: 700; font-size: 12px; letter-spacing: 0.18em; color: #22e1ff; }
      .brand-sub { font-size: 8px; letter-spacing: 0.3em; color: #5d6985; }
      .card-body { display: grid; grid-template-columns: 1fr auto; gap: 12px; margin-top: 10px; flex: 1; min-height: 0; }
      .left { display: flex; flex-direction: column; }
      .label { font-size: 7px; text-transform: uppercase; letter-spacing: 0.2em; color: #5d6985; }
      .value { font-size: 12px; font-weight: 600; color: #e9edf7; line-height: 1.1; }
      .value.name { font-size: 14px; }
      .value.small { font-size: 10px; font-weight: 500; }
      .value.mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
      .mt-3 { margin-top: 7px; }
      .right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
      .qr { width: 60px; height: 60px; background: #fff; padding: 4px; border-radius: 4px; }
      .uid { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #22e1ff; }
      .card-footer {
        font-size: 7px;
        color: #5d6985;
        letter-spacing: 0.08em;
        margin-top: 8px;
        text-align: center;
      }

      @media print {
        @page { size: auto; margin: 10mm; }
        body { background: white !important; }
        .print\\:hidden { display: none !important; }
      }
    `}</style>
  );
}
