// Shared enum-style constants. Defined here (not imported from @prisma/client)
// so the same TypeScript works with both schemas:
//   - Postgres schema uses real Prisma enums (typed identically to these).
//   - SQLite schema stores these as String columns (SQLite has no enum type).
// The runtime VALUES are identical strings, so DB rows round-trip cleanly.

export const UserRole = {
  ADMIN: 'ADMIN',
  OPERATOR: 'OPERATOR',
  DRIVER: 'DRIVER',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const SubscriptionStatus = {
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  GRACE_PERIOD: 'GRACE_PERIOD',   // expired but gate still opens (banner)
  LAPSED: 'LAPSED',                // past grace — entry denied, re-onboard needed
  SUSPENDED: 'SUSPENDED',
  BLACKLISTED: 'BLACKLISTED',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

// Which milestone in the renewal drip a reminder represents.
export const ReminderKind = {
  T_MINUS_14: 'T_MINUS_14',
  T_MINUS_7:  'T_MINUS_7',
  T_MINUS_3:  'T_MINUS_3',
  T_MINUS_1:  'T_MINUS_1',
  T_ZERO:     'T_ZERO',           // day of expiry
  GRACE_1:    'GRACE_1',           // first day of grace
  LAPSED:     'LAPSED',            // post-grace cutoff
  MANUAL:     'MANUAL',            // operator-initiated ad-hoc message
} as const;
export type ReminderKind = (typeof ReminderKind)[keyof typeof ReminderKind];

export const ReminderChannel = {
  WHATSAPP: 'WHATSAPP',
  SMS:      'SMS',
  EMAIL:    'EMAIL',
  IN_APP:   'IN_APP',
} as const;
export type ReminderChannel = (typeof ReminderChannel)[keyof typeof ReminderChannel];

export const ReminderStatus = {
  SCHEDULED: 'SCHEDULED',
  SENDING:   'SENDING',
  SENT:      'SENT',                // adapter accepted it (provider got it)
  DELIVERED: 'DELIVERED',           // recipient received it (provider confirmed)
  FAILED:    'FAILED',
  CANCELLED: 'CANCELLED',           // driver renewed before send
  DRY_RUN:   'DRY_RUN',             // would have sent — no provider configured
} as const;
export type ReminderStatus = (typeof ReminderStatus)[keyof typeof ReminderStatus];

export const GateDirection = {
  ENTRY: 'ENTRY',
  EXIT: 'EXIT',
  BIDIRECTIONAL: 'BIDIRECTIONAL',
} as const;
export type GateDirection = (typeof GateDirection)[keyof typeof GateDirection];

export const GateStatus = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  MAINTENANCE: 'MAINTENANCE',
} as const;
export type GateStatus = (typeof GateStatus)[keyof typeof GateStatus];

export const CardStatus = {
  IN_STOCK: 'IN_STOCK',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  LOST: 'LOST',
  BLACKLISTED: 'BLACKLISTED',
  RETIRED: 'RETIRED',
} as const;
export type CardStatus = (typeof CardStatus)[keyof typeof CardStatus];

export const TapResult = {
  GRANTED: 'GRANTED',
  DENIED_CARD_UNKNOWN: 'DENIED_CARD_UNKNOWN',
  DENIED_CARD_INACTIVE: 'DENIED_CARD_INACTIVE',
  DENIED_CARD_LOST: 'DENIED_CARD_LOST',
  DENIED_CARD_BLACKLISTED: 'DENIED_CARD_BLACKLISTED',
  DENIED_CARD_EXPIRED: 'DENIED_CARD_EXPIRED',
  DENIED_CARD_UNASSIGNED: 'DENIED_CARD_UNASSIGNED',
  DENIED_NO_SUBSCRIPTION: 'DENIED_NO_SUBSCRIPTION',
  DENIED_SUBSCRIPTION_EXPIRED: 'DENIED_SUBSCRIPTION_EXPIRED',
  DENIED_SUBSCRIPTION_SUSPENDED: 'DENIED_SUBSCRIPTION_SUSPENDED',
  DENIED_VEHICLE_UNKNOWN: 'DENIED_VEHICLE_UNKNOWN',
  DENIED_GATE_OFFLINE: 'DENIED_GATE_OFFLINE',
  DENIED_GATE_UNAUTHORIZED: 'DENIED_GATE_UNAUTHORIZED',
  ERROR: 'ERROR',
} as const;
export type TapResult = (typeof TapResult)[keyof typeof TapResult];

export const AuditCategory = {
  AUTH: 'AUTH',
  CARD: 'CARD',
  TAP: 'TAP',
  GATE_COMMAND: 'GATE_COMMAND',
  SUBSCRIPTION: 'SUBSCRIPTION',
  SETTINGS: 'SETTINGS',
  ADMIN_ACTION: 'ADMIN_ACTION',
} as const;
export type AuditCategory = (typeof AuditCategory)[keyof typeof AuditCategory];

export const CardAssignmentReason = {
  INITIAL_ISSUE: 'INITIAL_ISSUE',
  TRANSFER: 'TRANSFER',
  LOST: 'LOST',
  REPLACEMENT: 'REPLACEMENT',
  RETURN: 'RETURN',
  BLACKLIST: 'BLACKLIST',
} as const;
export type CardAssignmentReason = (typeof CardAssignmentReason)[keyof typeof CardAssignmentReason];
