'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { PageHeader, ErrorBox } from '@/components/ui';

// Single-page wizard that creates: driver+user+vehicle (one txn) → subscription
// → card. Three API calls in sequence. Each step's data is independently valid
// so a partial onboarding ends in a recoverable state (the operator can finish
// from the driver detail page).

type Plan = {
  id: string;
  name: string;
  priceCents: number;
  durationDays: number;
  active: boolean;
};

type DriverInfo = {
  fullName: string;
  email: string;
  phone: string;
  company: string;
};
type VehicleInfo = {
  plate: string;
  type: 'CAR' | 'LORRY' | 'VAN' | 'MOTORCYCLE';
};
type PlanInfo = {
  planId: string | 'custom';
  planName: string;
  priceMyr: number;
  durationDays: number;
};
type CardInfo = {
  uid: string;
  label: string;
};

const STEPS = ['Driver', 'Vehicle', 'Plan', 'Card', 'Review'] as const;
type StepIdx = 0 | 1 | 2 | 3 | 4;

export default function OnboardClient() {
  const router = useRouter();
  const [step, setStep] = useState<StepIdx>(0);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [driver, setDriver] = useState<DriverInfo>({
    fullName: '',
    email: '',
    phone: '',
    company: '',
  });
  const [vehicle, setVehicle] = useState<VehicleInfo>({ plate: '', type: 'CAR' });
  const [plan, setPlan] = useState<PlanInfo>({ planId: '', planName: '', priceMyr: 0, durationDays: 30 });
  const [card, setCard] = useState<CardInfo>({ uid: '', label: '' });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    driverId: string;
    publicId: string;
    tempPassword: string;
    portalUrl: string;
    addedToExisting: boolean;
  } | null>(null);

  // When the operator types an email that's already in use, this gets set
  // and the wizard flips into "add vehicle to existing driver" mode.
  const [existing, setExisting] = useState<{
    id: string;
    publicId: string;
    fullName: string;
    phone: string;
    vehicles: Array<{ plate: string; type: string }>;
  } | null>(null);

  useEffect(() => {
    api<Plan[]>('/plans').then(setPlans).catch(() => {});
  }, []);

  // Debounced email lookup — fires when the operator stops typing for ~400ms
  // and the email is valid-looking. If an existing driver matches, surface
  // them so the operator can add the new vehicle to that driver instead of
  // creating a duplicate.
  useEffect(() => {
    const email = driver.email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setExisting(null);
      return;
    }
    const t = setTimeout(() => {
      api<typeof existing>(`/drivers/by-email/${encodeURIComponent(email)}`)
        .then((found) => setExisting(found))
        .catch(() => setExisting(null));
    }, 400);
    return () => clearTimeout(t);
  }, [driver.email]);

  function next() {
    setError(null);
    if (!validateStep(step)) return;
    setStep((s) => Math.min(4, s + 1) as StepIdx);
  }
  function back() {
    setError(null);
    setStep((s) => Math.max(0, s - 1) as StepIdx);
  }

  function validateStep(s: StepIdx): boolean {
    if (s === 0) {
      if (!driver.fullName.trim()) return setErr('Full name is required');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(driver.email)) return setErr('Valid email required');
      if (!/^\+?\d{8,15}$/.test(driver.phone)) return setErr('Valid phone required (e.g. +60123456789)');
    } else if (s === 1) {
      if (!vehicle.plate.trim()) return setErr('Plate is required');
    } else if (s === 2) {
      if (!plan.planName.trim()) return setErr('Pick a plan or enter a custom name');
      if (plan.priceMyr < 0) return setErr('Price cannot be negative');
      if (plan.durationDays < 1) return setErr('Duration must be at least 1 day');
    } else if (s === 3) {
      if (card.uid.trim() && card.uid.replace(/[^a-fA-F0-9]/g, '').length === 0) {
        return setErr('Card UID must contain hex characters');
      }
    }
    return true;
  }
  function setErr(msg: string) {
    setError(msg);
    return false;
  }

  function selectPlan(p: Plan) {
    setPlan({
      planId: p.id,
      planName: p.name,
      priceMyr: p.priceCents / 100,
      durationDays: p.durationDays,
    });
  }

  async function submit() {
    setBusy(true);
    setError(null);
    let driverId: string | null = null;
    let publicId: string | null = null;
    try {
      let portalUrl = `${window.location.origin}/driver/login`;
      let tempPassword = '';
      let addedToExisting = false;

      if (existing) {
        // Path A: add vehicle to the existing driver. Skip user/password
        // creation; their existing credentials still work.
        driverId = existing.id;
        publicId = existing.publicId;
        addedToExisting = true;

        await api('/vehicles', {
          method: 'POST',
          body: { driverId: existing.id, plate: vehicle.plate, type: vehicle.type },
        });
      } else {
        // Path B: brand new driver. Auto-generates password + sends WhatsApp.
        const d = await api<{ id: string; publicId: string; tempPassword?: string; portalUrl?: string }>('/drivers', {
          method: 'POST',
          body: {
            fullName: driver.fullName,
            email: driver.email,
            phone: driver.phone,
            company: driver.company || undefined,
            vehiclePlate: vehicle.plate,
            vehicleType: vehicle.type,
          },
        });
        driverId = d.id;
        publicId = d.publicId;
        tempPassword = d.tempPassword ?? '';
        if (d.portalUrl) portalUrl = d.portalUrl;
      }

      // Subscription — always created (both paths)
      await api('/subscriptions', {
        method: 'POST',
        body: {
          driverId: driverId!,
          planName: plan.planName,
          priceCents: Math.round(plan.priceMyr * 100),
          durationDays: plan.durationDays,
        },
      });

      // Card — always issued (both paths). Backend auto-assigns PSC-NNN if UID empty.
      const uid = card.uid.trim();
      await api('/cards', {
        method: 'POST',
        body: { uid: uid || undefined, label: card.label || undefined, driverId: driverId! },
      });

      setResult({
        driverId: driverId!,
        publicId: publicId!,
        tempPassword,
        portalUrl,
        addedToExisting,
      });
    } catch (e) {
      const msg = errorMessage(e);
      setError(
        driverId
          ? `${msg}. Driver ${publicId} exists — finish onboarding from their detail page.`
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const printCard = () => window.open(`/admin/drivers/${result.driverId}/print/card`, '_blank');
    const printWelcome = () =>
      window.open(
        `/admin/drivers/${result.driverId}/print/welcome?temp=${encodeURIComponent(result.tempPassword)}&portal=${encodeURIComponent(result.portalUrl)}`,
        '_blank',
      );
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <PageHeader eyebrow="Done" title={result.addedToExisting ? 'Vehicle added' : 'Driver onboarded'} />
        <div className="panel-strong p-7">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/40 text-emerald-300 text-2xl shrink-0">
              ✓
            </div>
            <div className="flex-1">
              <h2 className="font-display text-2xl">
                {result.addedToExisting
                  ? `Vehicle added to ${existing?.fullName ?? 'existing driver'}`
                  : `${driver.fullName} is onboarded`}
              </h2>
              <p className="text-text-muted text-sm mt-1">
                Driver ID <span className="font-mono text-text-primary">{result.publicId}</span> · plate{' '}
                <span className="font-mono text-text-primary">{vehicle.plate.toUpperCase()}</span>
                {result.addedToExisting && (
                  <> · {(existing?.vehicles.length ?? 0) + 1} total vehicle{(existing?.vehicles.length ?? 0) + 1 === 1 ? '' : 's'} now on file</>
                )}
              </p>
            </div>
          </div>

          {result.tempPassword && (
            <div className="mt-6 rounded-xl bg-bg-elevated/60 ring-1 ring-amber-500/30 p-5">
              <div className="text-xs text-amber-300 tracking-[0.2em] uppercase">⚠ Credentials — visible once only</div>
              <div className="mt-3 grid grid-cols-[120px_1fr] gap-x-4 gap-y-2 text-sm">
                <div className="text-text-secondary">Username</div>
                <div className="font-mono text-text-primary text-base">{vehicle.plate.toUpperCase()}</div>
                <div className="text-text-secondary">Temp password</div>
                <div className="font-mono text-text-primary text-base">{result.tempPassword}</div>
                <div className="text-text-secondary">Portal URL</div>
                <div className="font-mono text-text-primary break-all">{result.portalUrl}</div>
              </div>
              <p className="text-xs text-text-muted mt-4">
                WhatsApp message with these credentials has been queued to <span className="font-mono">{driver.phone}</span>.
                In DRY-RUN mode the message is logged (not sent) — print the welcome slip below as the source of truth.
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2 justify-end">
            <button
              onClick={printWelcome}
              className="rounded-lg bg-accent-cyan/15 text-accent-cyan ring-1 ring-accent-cyan/40 px-4 py-2.5 text-sm hover:bg-accent-cyan/25"
            >
              🖨 Print welcome slip
            </button>
            {card.uid && (
              <button
                onClick={printCard}
                className="rounded-lg bg-accent-violet/15 text-accent-violet ring-1 ring-accent-violet/40 px-4 py-2.5 text-sm hover:bg-accent-violet/25"
              >
                🖨 Print RFID card
              </button>
            )}
            <Link
              href={`/admin/drivers/${result.driverId}`}
              className="rounded-lg bg-gradient-to-r from-accent-cyan to-accent-violet px-5 py-2.5 text-sm font-medium text-black/90"
            >
              Open driver profile →
            </Link>
            <button
              onClick={() => {
                setResult(null);
                setStep(0);
                setDriver({ fullName: '', email: '', phone: '', company: '' });
                setVehicle({ plate: '', type: 'CAR' });
                setPlan({ planId: '', planName: '', priceMyr: 0, durationDays: 30 });
                setCard({ uid: '', label: '' });
                setExisting(null);
              }}
              className="rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-4 py-2.5 text-sm"
            >
              Onboard another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Customers"
        title="Onboard new driver"
        description="One screen, four steps. Creates the driver, their primary vehicle, an active subscription, and (optionally) issues their first card."
      />

      <ol className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1 flex items-center gap-2">
            <div
              className={cn(
                'grid h-7 w-7 place-items-center rounded-full text-xs font-bold ring-1 shrink-0',
                i < step
                  ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/40'
                  : i === step
                    ? 'bg-accent-cyan/15 text-accent-cyan ring-accent-cyan/40'
                    : 'bg-bg-elevated text-text-muted ring-bg-ring',
              )}
            >
              {i < step ? '✓' : i + 1}
            </div>
            <div className={cn('text-xs', i === step ? 'text-text-primary' : 'text-text-muted')}>{label}</div>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-bg-ring/60" />}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="panel-strong p-7"
        >
          {step === 0 && (
            <div>
              <h2 className="font-display text-xl">Driver information</h2>
              <p className="text-text-muted text-sm mt-1">Contact details. A temporary password is generated automatically and sent via WhatsApp.</p>
              <div className="grid grid-cols-2 gap-4 mt-5">
                <TF label="Full name" value={driver.fullName} onChange={(v) => setDriver({ ...driver, fullName: v })} />
                <TF label="Phone" value={driver.phone} onChange={(v) => setDriver({ ...driver, phone: v })} placeholder="+60123456789" />
                <TF label="Email" type="email" value={driver.email} onChange={(v) => setDriver({ ...driver, email: v })} />
                <TF label="Company / Fleet (optional)" value={driver.company} onChange={(v) => setDriver({ ...driver, company: v })} />
              </div>

              {existing ? (
                <div className="mt-5 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/40 text-amber-100 px-4 py-3 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="text-xl leading-none">📧</span>
                    <div className="flex-1">
                      <div className="font-display">This email already belongs to {existing.fullName}</div>
                      <div className="text-xs text-amber-200/80 mt-1">
                        Driver ID <span className="font-mono">{existing.publicId}</span> · {existing.vehicles.length} vehicle{existing.vehicles.length === 1 ? '' : 's'} on file ({existing.vehicles.map((v) => v.plate).join(', ')}).
                      </div>
                      <div className="text-xs text-amber-100/90 mt-2">
                        The new vehicle, subscription, and card will be <strong>added to this driver's account</strong>. Their existing login + password are unchanged.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-lg bg-cyan-500/10 ring-1 ring-cyan-500/30 text-cyan-200 px-3 py-2 text-xs">
                  <strong>Auto-generated password.</strong> The driver will receive credentials via WhatsApp and must change the password on first login.
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="font-display text-xl">Primary vehicle</h2>
              <p className="text-text-muted text-sm mt-1">The plate this driver will normally bring through the gate.</p>
              <div className="grid grid-cols-2 gap-4 mt-5">
                <TF label="Plate" value={vehicle.plate} onChange={(v) => setVehicle({ ...vehicle, plate: v })} placeholder="WXY1234" />
                <SF
                  label="Type"
                  value={vehicle.type}
                  onChange={(v) => setVehicle({ ...vehicle, type: v as 'CAR' })}
                  options={['CAR', 'LORRY', 'VAN', 'MOTORCYCLE']}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-display text-xl">Subscription plan</h2>
              <p className="text-text-muted text-sm mt-1">Pick a preset or define a one-off.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5">
                {plans.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => selectPlan(p)}
                    className={cn(
                      'text-left rounded-xl p-4 ring-1 transition',
                      plan.planId === p.id
                        ? 'bg-accent-cyan/10 ring-accent-cyan/40'
                        : 'bg-bg-elevated/60 ring-bg-ring hover:ring-cyan-500/30',
                    )}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-display">{p.name}</span>
                      <span className="font-mono text-sm">RM {(p.priceCents / 100).toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-text-muted mt-1">{p.durationDays} days</div>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setPlan({
                      planId: 'custom',
                      planName: plan.planId === 'custom' ? plan.planName : 'Custom Monthly',
                      priceMyr: plan.priceMyr || 100,
                      durationDays: plan.durationDays || 30,
                    })
                  }
                  className={cn(
                    'text-left rounded-xl p-4 ring-1 transition border-dashed',
                    plan.planId === 'custom'
                      ? 'bg-accent-violet/10 ring-accent-violet/40'
                      : 'bg-bg-elevated/30 ring-bg-ring border hover:ring-violet-500/30',
                  )}
                >
                  <div className="font-display">Custom…</div>
                  <div className="text-xs text-text-muted mt-1">One-off plan for this driver</div>
                </button>
              </div>

              {plan.planId === 'custom' && (
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <TF label="Plan name" value={plan.planName} onChange={(v) => setPlan({ ...plan, planName: v })} />
                  <NF label="Price RM" value={plan.priceMyr} onChange={(v) => setPlan({ ...plan, priceMyr: v })} step={0.01} />
                  <NF label="Duration (d)" value={plan.durationDays} onChange={(v) => setPlan({ ...plan, durationDays: v })} />
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-display text-xl">Issue card</h2>
              <p className="text-text-muted text-sm mt-1">
                A card is always issued on driver creation. Leave UID blank to auto-assign
                the next sequential ID (PSC-001, PSC-002, …). Provide a hex UID when issuing
                from a real RFID/NFC scan.
              </p>
              <div className="grid grid-cols-2 gap-4 mt-5">
                <TF label="Card UID (blank = auto)" value={card.uid} onChange={(v) => setCard({ ...card, uid: v })} placeholder="leave blank, or paste scanned hex" mono />
                <TF label="Label (optional)" value={card.label} onChange={(v) => setCard({ ...card, label: v })} placeholder="auto: 'Driver Card #001'" />
              </div>
              <div className="mt-5 rounded-lg bg-cyan-500/10 ring-1 ring-cyan-500/30 text-cyan-200 px-3 py-2 text-xs">
                <strong>Auto-issue:</strong> the system assigns a unique, sequential card ID
                so the printed card is ready immediately. Replace later with a real RFID UID
                from <em>Cards → Replace</em> if you tag a physical card afterwards.
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="font-display text-xl">Review &amp; create</h2>
              <p className="text-text-muted text-sm mt-1">Confirm before we create the records.</p>

              {existing && (
                <div className="mt-4 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/40 text-amber-100 px-4 py-3 text-sm">
                  <strong>Adding vehicle to existing driver {existing.fullName}</strong> ({existing.publicId}).
                  No new user/password will be created.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-5 text-sm">
                {!existing && <Review label="Name" value={driver.fullName} />}
                <Review label="Email" value={driver.email} />
                {!existing && <Review label="Phone" value={driver.phone} mono />}
                {!existing && <Review label="Company" value={driver.company || '—'} />}
                <Review label="Plate (new)" value={vehicle.plate.toUpperCase()} mono />
                <Review label="Type" value={vehicle.type} />
                <Review label="Plan" value={plan.planName} />
                <Review label="Price / duration" value={`RM ${plan.priceMyr.toFixed(2)} for ${plan.durationDays}d`} />
                <Review label="Card UID" value={card.uid ? card.uid.toUpperCase().replace(/[^A-F0-9]/g, '') : '(auto-assigned)'} mono />
                <Review label="Card label" value={card.label || '(auto)'} />
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <ErrorBox message={error} />

      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/admin/drivers')}
          className="text-xs text-text-muted hover:text-text-primary"
        >
          Cancel
        </button>
        <div className="flex gap-2">
          {step > 0 && (
            <button
              onClick={back}
              disabled={busy}
              className="rounded-lg bg-bg-elevated ring-1 ring-bg-ring px-4 py-2 text-sm"
            >
              ← Back
            </button>
          )}
          {step < 4 ? (
            <button
              onClick={next}
              className="rounded-lg bg-gradient-to-r from-accent-cyan to-accent-violet px-5 py-2 text-sm font-medium text-black/90"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={busy}
              className="rounded-lg bg-gradient-to-r from-accent-cyan to-accent-violet px-5 py-2 text-sm font-medium text-black/90 disabled:opacity-60"
            >
              {busy ? 'Creating…' : 'Create driver'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TF({
  label, value, onChange, type = 'text', placeholder, className, mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={className}>
      <label className="block text-xs text-text-secondary">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm',
          mono && 'font-mono',
        )}
      />
    </div>
  );
}
function NF({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <label className="block text-xs text-text-secondary">{label}</label>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm"
      />
    </div>
  );
}
function SF({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="block text-xs text-text-secondary">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg bg-bg-elevated border border-bg-ring px-3 py-2 text-sm"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function Review({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg bg-bg-elevated/60 ring-1 ring-bg-ring px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.2em] text-text-muted">{label}</div>
      <div className={cn('text-sm mt-0.5', mono && 'font-mono')}>{value}</div>
    </div>
  );
}
