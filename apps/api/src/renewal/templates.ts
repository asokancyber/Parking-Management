// Reminder template library. The kind on a Reminder row is a string of the form:
//   - "T_MINUS_<n>"   — n days before expiry (e.g. T_MINUS_3, T_MINUS_5)
//   - "T_ZERO"        — day of expiry
//   - "GRACE_1"       — first day of grace period
//   - "LAPSED"        — past grace cutoff
//   - "MANUAL"        — operator-initiated ad-hoc message
//
// Well-known kinds get a tailored template here. For any T_MINUS_<n> not in
// this list (e.g. operator added "5 days before"), we fall back to a generic
// template that interpolates the day count.

export interface TemplateVars {
  driverFirstName: string;
  driverFullName: string;
  planName: string;
  priceMyr: string;       // pre-formatted '350.00'
  expiresAtDate: string;  // '24 Jun 2026'
  daysLeft: number;
  gracePeriodDays: number;
  publicId: string;
}

export interface Template {
  kind: string;
  name: string;
  body: (v: TemplateVars) => string;
}

const TEMPLATES: Template[] = [
  {
    kind: 'T_MINUS_14',
    name: 'parksphere_renew_t14',
    body: (v) =>
      `Hi ${v.driverFirstName}, your ${v.planName} parking subscription expires in 14 days ` +
      `on ${v.expiresAtDate}. Renew anytime at reception. Driver ID: ${v.publicId}.`,
  },
  {
    kind: 'T_MINUS_7',
    name: 'parksphere_renew_t7',
    body: (v) =>
      `Hi ${v.driverFirstName} — your parking subscription (${v.planName}) ` +
      `expires in 7 days. Renewal is RM ${v.priceMyr}. Visit reception to renew.`,
  },
  {
    kind: 'T_MINUS_3',
    name: 'parksphere_renew_t3',
    body: (v) =>
      `*Reminder*: ${v.driverFirstName}, only 3 days left on your parking subscription. ` +
      `Please renew (RM ${v.priceMyr}) before ${v.expiresAtDate} to avoid gate denial.`,
  },
  {
    kind: 'T_MINUS_1',
    name: 'parksphere_renew_t1',
    body: (v) =>
      `*Urgent*: ${v.driverFirstName}, your parking subscription expires TOMORROW (${v.expiresAtDate}). ` +
      `Renew at reception today to keep your access.`,
  },
  {
    kind: 'T_ZERO',
    name: 'parksphere_renew_t0',
    body: (v) =>
      `Your parking subscription expires TODAY, ${v.driverFirstName}. ` +
      `You have a ${v.gracePeriodDays}-day grace period — please renew immediately.`,
  },
  {
    kind: 'GRACE_1',
    name: 'parksphere_grace',
    body: (v) =>
      `Hi ${v.driverFirstName}, your subscription expired and you are in a ${v.gracePeriodDays}-day grace period. ` +
      `The gate still opens, but please renew to avoid full loss of access.`,
  },
  {
    kind: 'LAPSED',
    name: 'parksphere_lapsed',
    body: (v) =>
      `${v.driverFullName}, your parking access has now lapsed. ` +
      `Please visit reception to reactivate your subscription (${v.planName}, RM ${v.priceMyr}).`,
  },
  {
    kind: 'MANUAL',
    name: 'parksphere_manual',
    body: (v) =>
      `Hi ${v.driverFirstName}, this is a reminder from ParkSphere reception ` +
      `about your subscription (${v.planName}). Please respond to this number.`,
  },
];

const byKind = new Map(TEMPLATES.map((t) => [t.kind, t]));

// Generic template for any custom T_MINUS_<n> day that doesn't have its own
// tailored copy above.
function genericTMinus(days: number): Template {
  return {
    kind: `T_MINUS_${days}`,
    name: 'parksphere_renew_generic',
    body: (v) =>
      `Hi ${v.driverFirstName}, your parking subscription (${v.planName}) ` +
      `expires in ${days} days on ${v.expiresAtDate}. ` +
      `Renew (RM ${v.priceMyr}) at reception to keep your access.`,
  };
}

export function getTemplate(kind: string): Template {
  const fixed = byKind.get(kind);
  if (fixed) return fixed;
  const m = /^T_MINUS_(\d+)$/.exec(kind);
  if (m) return genericTMinus(Number(m[1]));
  throw new Error(`No template resolvable for kind=${kind}`);
}

export function listTemplates(): Template[] {
  return TEMPLATES;
}
