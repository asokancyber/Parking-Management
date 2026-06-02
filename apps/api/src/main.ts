import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const log = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const config = app.get(ConfigService);
  // Render / Heroku / Railway inject PORT. Local dev uses API_PORT. Default 4000.
  const port = Number(
    config.get<string>('PORT') ?? config.get<string>('API_PORT') ?? '4000',
  );
  const corsOrigin = config.get<string>('API_CORS_ORIGIN', 'http://localhost:3000');

  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api/v1');

  // Run a pre-flight DB + schema probe BEFORE we open the port. If the
  // database isn't reachable or is missing tables (the classic "schema
  // changed but you forgot to re-run setup" trap), fail loud and clear here
  // instead of letting the API limp along and 500 on first request.
  const prisma = app.get(PrismaService);
  const preflight = await preflightCheck(prisma);

  await app.listen(port);

  banner({
    url: `http://localhost:${port}`,
    cors: corsOrigin,
    dbUrl: maskDb(config.get<string>('DATABASE_URL') ?? ''),
    preflight,
  });

  if (!preflight.ok) {
    log.error('Pre-flight check FAILED — see banner above. Run reset.bat then setup.bat.');
  }
}

async function preflightCheck(prisma: PrismaService): Promise<{ ok: boolean; details: string[] }> {
  const details: string[] = [];
  let ok = true;
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    details.push('  database connection ........ OK');
  } catch (err) {
    ok = false;
    details.push(`  database connection ........ FAIL: ${(err as Error).message}`);
    return { ok, details };
  }

  const expected = ['User', 'Driver', 'Card', 'Gate', 'CardTapEvent'];
  for (const t of expected) {
    try {
      await prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "${t}" LIMIT 1`);
      details.push(`  table ${t.padEnd(15)} ......... OK`);
    } catch {
      ok = false;
      details.push(`  table ${t.padEnd(15)} ......... MISSING (run setup.bat to push schema)`);
    }
  }
  return { ok, details };
}

function maskDb(url: string): string {
  if (!url) return '(unset)';
  // Mask credentials in any postgres-style URL; show driver + host.
  return url.replace(/(\w+:\/\/)([^:]+):([^@]+)@/, '$1***:***@');
}

function banner(info: {
  url: string;
  cors: string;
  dbUrl: string;
  preflight: { ok: boolean; details: string[] };
}) {
  const line = '═'.repeat(64);
  const status = info.preflight.ok ? '\x1b[32mREADY\x1b[0m' : '\x1b[31mSTARTED WITH ERRORS\x1b[0m';
  // eslint-disable-next-line no-console
  console.log(
    [
      '',
      line,
      `  ParkSphere API — ${status}`,
      line,
      `  Listening:  ${info.url}/api/v1`,
      `  Health:     ${info.url}/api/v1/health`,
      `  Allow CORS: ${info.cors}`,
      `  Database:   ${info.dbUrl}`,
      '',
      '  Pre-flight checks:',
      ...info.preflight.details,
      line,
      '',
    ].join('\n'),
  );
}

bootstrap();
