'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { api, errorMessage } from '@/lib/api';

type Driver = {
  publicId: string;
  fullName: string;
  company: string | null;
  phone: string;
  vehicles: Array<{ plate: string; type: string }>;
  subscriptions: Array<{ planName: string; priceCents: number; expiresAt: string; status: string }>;
};

// Printable welcome slip — handed to the driver at reception with their
// portal credentials. The temp password is passed via querystring so it's
// shown ONCE only on this printout, never persisted in the URL history of
// any logged-in admin (closed after print).
export default function WelcomePrintClient({ id }: { id: string }) {
  const search = useSearchParams();
  const tempPassword = search.get('temp') ?? '';
  const portalUrl =
    search.get('portal') ?? (typeof window !== 'undefined' ? `${window.location.origin}/driver/login` : '');

  const [driver, setDriver] = useState<Driver | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Driver>(`/drivers/${id}`)
      .then(async (d) => {
        setDriver(d);
        if (portalUrl) {
          const url = await QRCode.toDataURL(portalUrl, { width: 240, margin: 1 });
          setQr(url);
        }
      })
      .catch((e) => setError(errorMessage(e)));
  }, [id, portalUrl]);

  if (error) return <div className="p-10 text-rose-300">{error}</div>;
  if (!driver) return <div className="p-10 text-text-muted">Loading…</div>;

  const vehicle = driver.vehicles[0];
  const sub = driver.subscriptions[0];

  return (
    <>
      <PrintStyles />
      <div className="min-h-screen bg-bg-base text-text-primary p-8 flex flex-col items-center gap-6 print:bg-white print:text-black print:p-0">
        <div className="print:hidden flex gap-3">
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-gradient-to-r from-accent-cyan to-accent-violet px-5 py-2.5 text-sm font-medium text-black/90"
          >
            🖨 Print welcome slip
          </button>
          <button
            onClick={() => window.close()}
            className="rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-4 py-2.5 text-sm"
          >
            Close
          </button>
        </div>

        <div className="slip">
          <header className="slip-head">
            <div>
              <div className="brand">PARKSPHERE ENTERPRISE</div>
              <div className="sub">Driver welcome pack</div>
            </div>
            <div className="date">Issued {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          </header>

          <section className="hello">
            <h1>Welcome, {driver.fullName.split(' ')[0]}.</h1>
            <p>
              Your ParkSphere account is ready. Use the credentials below to log in to the driver portal and{' '}
              <strong>set your own password</strong> on first login. Keep this slip somewhere safe.
            </p>
          </section>

          <section className="creds">
            <div className="cred-row">
              <div className="cred-label">Driver ID</div>
              <div className="cred-value mono">{driver.publicId}</div>
            </div>
            <div className="cred-row">
              <div className="cred-label">Username (vehicle plate)</div>
              <div className="cred-value mono large">{vehicle?.plate ?? '—'}</div>
            </div>
            <div className="cred-row">
              <div className="cred-label">Temporary password</div>
              <div className="cred-value mono large">{tempPassword || '— (not provided)'}</div>
            </div>
            <div className="cred-row">
              <div className="cred-label">Login URL</div>
              <div className="cred-value mono">{portalUrl}</div>
            </div>
          </section>

          {qr && (
            <section className="qr-section">
              <img src={qr} alt="portal QR" className="qr" />
              <div className="qr-caption">Scan to open the portal on your phone</div>
            </section>
          )}

          {sub && (
            <section className="sub-section">
              <div className="sub-row"><span>Plan</span><strong>{sub.planName}</strong></div>
              <div className="sub-row"><span>Price</span><strong>RM {(sub.priceCents / 100).toFixed(2)}</strong></div>
              <div className="sub-row"><span>Valid until</span><strong>{new Date(sub.expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
            </section>
          )}

          <footer className="slip-foot">
            <strong>Important:</strong> the temporary password above is one-time use. You will be required to change it on first login.
            For help, visit reception or WhatsApp <span className="mono">+60 12 345 6789</span>.
          </footer>
        </div>
      </div>
    </>
  );
}

function PrintStyles() {
  return (
    <style jsx global>{`
      .slip {
        width: 600px;
        background: white;
        color: #0a0e1a;
        padding: 32px;
        border-radius: 12px;
        font-family: -apple-system, 'Segoe UI', sans-serif;
        box-shadow: 0 20px 60px -20px rgba(0, 0, 0, 0.4);
      }
      .slip-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        border-bottom: 2px solid #22e1ff;
        padding-bottom: 12px;
      }
      .brand { font-weight: 800; letter-spacing: 0.15em; font-size: 14px; }
      .sub { font-size: 10px; color: #5d6985; letter-spacing: 0.2em; text-transform: uppercase; }
      .date { font-size: 10px; color: #5d6985; }
      .hello { margin-top: 20px; }
      .hello h1 { font-size: 22px; margin: 0 0 8px 0; }
      .hello p { font-size: 13px; line-height: 1.5; color: #2c364f; margin: 0; }
      .creds {
        margin-top: 24px;
        background: #f1f5fb;
        border: 1px dashed #94a3b8;
        border-radius: 8px;
        padding: 16px 18px;
      }
      .cred-row { padding: 6px 0; border-bottom: 1px solid #dfe6f0; display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
      .cred-row:last-child { border-bottom: 0; }
      .cred-label { font-size: 10px; color: #5d6985; text-transform: uppercase; letter-spacing: 0.1em; }
      .cred-value { text-align: right; }
      .cred-value.mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
      .cred-value.large { font-size: 18px; font-weight: 700; letter-spacing: 0.04em; }
      .qr-section { margin-top: 20px; text-align: center; }
      .qr { width: 140px; height: 140px; }
      .qr-caption { font-size: 10px; color: #5d6985; margin-top: 4px; }
      .sub-section { margin-top: 20px; }
      .sub-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; border-bottom: 1px solid #eef2f7; }
      .sub-row:last-child { border-bottom: 0; }
      .sub-row span { color: #5d6985; }
      .slip-foot { margin-top: 20px; font-size: 10px; color: #5d6985; line-height: 1.5; border-top: 1px solid #dfe6f0; padding-top: 12px; }
      .mono { font-family: 'JetBrains Mono', monospace; }

      @media print {
        @page { size: A5; margin: 12mm; }
        body { background: white !important; }
        .slip { box-shadow: none; border-radius: 0; }
        .print\\:hidden { display: none !important; }
      }
    `}</style>
  );
}
