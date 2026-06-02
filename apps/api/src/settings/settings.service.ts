import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AuditCategory, UserRole } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AuditService } from '../audit/audit.service';

// Runtime-configurable operator settings.
export const SETTING_KEYS = {
  TAP_DEBOUNCE_MS: 'tapDebounceMs',
  REMINDER_SCHEDULE: 'reminderSchedule',
} as const;

const TAP_DEBOUNCE_MIN_MS = 0;
const TAP_DEBOUNCE_MAX_MS = 60_000;
const TAP_DEBOUNCE_DEFAULT_MS = 1500;

// Reminder schedule shape. daysBeforeExpiry are integers (e.g. [3, 1] sends
// a reminder 3 days and 1 day before expiry). includeGrace / includeLapsed
// add post-expiry reminders. hourOfDay is the local hour (24h) the reminder
// fires at.
export interface ReminderSchedule {
  daysBeforeExpiry: number[];
  includeGrace: boolean;
  includeLapsed: boolean;
  hourOfDay: number; // 0-23
}

export const REMINDER_SCHEDULE_DEFAULT: ReminderSchedule = {
  daysBeforeExpiry: [3, 1],
  includeGrace: true,
  includeLapsed: true,
  hourOfDay: 9,
};

type Listener = (value: unknown) => void;

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private cache = new Map<string, unknown>();
  private listeners = new Map<string, Set<Listener>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly audit: AuditService,
  ) {}

  onChange(key: string, fn: Listener) {
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key)!.add(fn);
  }

  // ─────────── Tap debounce ───────────────────────────────────────
  async getTapDebounceMs(): Promise<number> {
    const raw = await this.read(SETTING_KEYS.TAP_DEBOUNCE_MS);
    const n = typeof raw === 'number' ? raw : TAP_DEBOUNCE_DEFAULT_MS;
    return this.clamp(n, TAP_DEBOUNCE_MIN_MS, TAP_DEBOUNCE_MAX_MS);
  }
  async setTapDebounceMs(ms: number, actorId?: string): Promise<number> {
    const clamped = this.clamp(ms, TAP_DEBOUNCE_MIN_MS, TAP_DEBOUNCE_MAX_MS);
    if (clamped !== ms) {
      throw new BadRequestException(
        `tapDebounceMs must be between ${TAP_DEBOUNCE_MIN_MS} and ${TAP_DEBOUNCE_MAX_MS}`,
      );
    }
    await this.persist(SETTING_KEYS.TAP_DEBOUNCE_MS, clamped, actorId);
    return clamped;
  }

  // ─────────── Reminder schedule ──────────────────────────────────
  async getReminderSchedule(): Promise<ReminderSchedule> {
    const raw = await this.read(SETTING_KEYS.REMINDER_SCHEDULE);
    if (!raw || typeof raw !== 'object') return REMINDER_SCHEDULE_DEFAULT;
    return this.normaliseSchedule(raw as Partial<ReminderSchedule>);
  }

  async setReminderSchedule(input: Partial<ReminderSchedule>, actorId?: string): Promise<ReminderSchedule> {
    const next = this.normaliseSchedule(input);
    await this.persist(SETTING_KEYS.REMINDER_SCHEDULE, next, actorId);
    return next;
  }

  // Validates + normalises a schedule input from the UI.
  private normaliseSchedule(input: Partial<ReminderSchedule>): ReminderSchedule {
    const rawDays = Array.isArray(input.daysBeforeExpiry) ? input.daysBeforeExpiry : REMINDER_SCHEDULE_DEFAULT.daysBeforeExpiry;
    // Dedup, drop NaN/negatives/huge values, sort descending (T-14 before T-1).
    const days = Array.from(new Set(rawDays.map((n) => Math.round(Number(n))).filter((n) => Number.isFinite(n) && n >= 0 && n <= 365)))
      .sort((a, b) => b - a);

    if (days.length > 10) throw new BadRequestException('Maximum 10 reminder days allowed');

    const hour = typeof input.hourOfDay === 'number' ? Math.round(input.hourOfDay) : REMINDER_SCHEDULE_DEFAULT.hourOfDay;
    if (hour < 0 || hour > 23) throw new BadRequestException('hourOfDay must be between 0 and 23');

    return {
      daysBeforeExpiry: days,
      includeGrace: Boolean(input.includeGrace ?? REMINDER_SCHEDULE_DEFAULT.includeGrace),
      includeLapsed: Boolean(input.includeLapsed ?? REMINDER_SCHEDULE_DEFAULT.includeLapsed),
      hourOfDay: hour,
    };
  }

  // ─────────── Bag of all settings ────────────────────────────────
  async getAll() {
    return {
      [SETTING_KEYS.TAP_DEBOUNCE_MS]: await this.getTapDebounceMs(),
      [SETTING_KEYS.REMINDER_SCHEDULE]: await this.getReminderSchedule(),
    };
  }

  // ─────────── Internal ────────────────────────────────────────────
  private async persist(key: string, value: unknown, actorId?: string) {
    const serialized = JSON.stringify(value);
    await this.prisma.appSetting.upsert({
      where: { key },
      create: { key, value: serialized, updatedBy: actorId ?? null },
      update: { value: serialized, updatedBy: actorId ?? null },
    });
    this.cache.set(key, value);
    await this.audit.log({
      category: AuditCategory.SETTINGS,
      action: 'settings.updated',
      actorId: actorId ?? null,
      actorRole: actorId ? UserRole.ADMIN : null,
      targetType: 'AppSetting',
      targetId: key,
      metadata: { value },
    });
    this.realtime.broadcastSettingChange(key, value);
    this.fireListeners(key, value);
  }

  private async read(key: string): Promise<unknown> {
    if (this.cache.has(key)) return this.cache.get(key);
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    let value: unknown = null;
    if (row?.value) {
      try {
        value = JSON.parse(row.value);
      } catch {
        this.logger.warn(`Setting '${key}' is not valid JSON; ignoring stored value`);
      }
    }
    this.cache.set(key, value);
    return value;
  }

  private clamp(n: number, min: number, max: number) {
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, Math.round(n)));
  }

  private fireListeners(key: string, value: unknown) {
    const set = this.listeners.get(key);
    if (!set) return;
    for (const fn of set) {
      try { fn(value); } catch (err) { this.logger.warn(`listener for ${key} threw: ${(err as Error).message}`); }
    }
  }
}
