import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendInput {
  toPhone: string;        // E.164 format, e.g. +60123456789
  body: string;
  templateName?: string;  // approved template id for WhatsApp Business API
}

export interface SendResult {
  mode: 'live' | 'dry';
  externalId?: string;    // provider's message SID / ID
  status: 'SENT' | 'FAILED' | 'DRY_RUN';
  error?: string;
}

// WhatsApp adapter. Two modes:
//
//   LIVE — requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
//          in env. Sends via Twilio's WhatsApp API. Twilio's sandbox lets you
//          test without business verification (recipient must opt in by
//          messaging the sandbox first).
//
//   DRY  — when any of the above env vars is missing. Logs the message,
//          records it to the Reminder row as DRY_RUN, returns success. Lets
//          you demo + develop the whole flow without paying Twilio.
//
// For production, the choice you typically make:
//   - Twilio  — easiest signup, ~$0.005/message (MY), full Business API
//   - Meta Cloud API direct — free up to 1000 conversations/month, requires
//     Meta Business Manager + brand verification
@Injectable()
export class WhatsAppAdapter {
  private readonly logger = new Logger(WhatsAppAdapter.name);
  private readonly sid?: string;
  private readonly token?: string;
  private readonly from?: string;

  constructor(config: ConfigService) {
    this.sid = config.get<string>('TWILIO_ACCOUNT_SID');
    this.token = config.get<string>('TWILIO_AUTH_TOKEN');
    this.from = config.get<string>('TWILIO_WHATSAPP_FROM');
    if (this.isLive()) {
      this.logger.log('WhatsApp adapter: LIVE (Twilio)');
    } else {
      this.logger.warn(
        'WhatsApp adapter: DRY-RUN — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM to go live',
      );
    }
  }

  isLive(): boolean {
    return Boolean(this.sid && this.token && this.from);
  }

  modeLabel(): 'live' | 'dry' {
    return this.isLive() ? 'live' : 'dry';
  }

  async send(input: SendInput): Promise<SendResult> {
    if (!this.isLive()) {
      this.logger.log(`[DRY-RUN] WhatsApp → ${input.toPhone}: ${input.body.slice(0, 80)}…`);
      return { mode: 'dry', status: 'DRY_RUN' };
    }

    try {
      // Twilio API expects "whatsapp:+60xxx" prefix on both To and From.
      const to = `whatsapp:${ensureE164(input.toPhone)}`;
      const from = this.from!.startsWith('whatsapp:') ? this.from! : `whatsapp:${this.from!}`;
      const body = new URLSearchParams({ To: to, From: from, Body: input.body });

      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`;
      const auth = Buffer.from(`${this.sid}:${this.token}`).toString('base64');

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          authorization: `Basic ${auth}`,
        },
        body,
      });

      const payload = (await res.json()) as { sid?: string; message?: string; code?: number };
      if (!res.ok) {
        return {
          mode: 'live',
          status: 'FAILED',
          error: payload.message ?? `Twilio HTTP ${res.status}`,
        };
      }
      return { mode: 'live', status: 'SENT', externalId: payload.sid };
    } catch (err) {
      return { mode: 'live', status: 'FAILED', error: (err as Error).message };
    }
  }
}

function ensureE164(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return trimmed;
  // Assume MY if no country code (defensive — driver registration validates this).
  if (/^0\d{8,11}$/.test(trimmed)) return `+6${trimmed}`;
  return `+${trimmed}`;
}
