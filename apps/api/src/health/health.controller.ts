import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Required application tables. The schema-drift check passes only if all of
// these exist, so a stale Prisma client (the classic "I forgot to re-run
// setup after a schema change" trap) shows up clearly in /health rather than
// as an opaque 500 mid-request.
const REQUIRED_TABLES = ['User', 'Driver', 'Vehicle', 'Subscription', 'Gate', 'Card', 'CardTapEvent', 'AuditLog'];

const startedAt = Date.now();

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const checks = {
      api: { ok: true, uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) },
      database: await this.checkDatabase(),
      schema: await this.checkSchema(),
    };
    const ok = checks.api.ok && checks.database.ok && checks.schema.ok;
    return { ok, checks, timestamp: new Date().toISOString() };
  }

  private async checkDatabase(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  // Works for both SQLite (sqlite_master) and Postgres (pg_catalog). Probes
  // each table with a count(*) which fails fast if the table doesn't exist.
  private async checkSchema(): Promise<{ ok: boolean; missing: string[]; error?: string }> {
    const missing: string[] = [];
    for (const table of REQUIRED_TABLES) {
      try {
        await this.prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "${table}" LIMIT 1`);
      } catch {
        missing.push(table);
      }
    }
    return { ok: missing.length === 0, missing };
  }
}
