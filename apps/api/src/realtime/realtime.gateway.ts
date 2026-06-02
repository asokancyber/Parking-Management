import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

// Channels:
//   gate:{gateId}   — gate monitor displays subscribe; receive tap events and
//                     OPEN_GATE commands for their gate
//   events          — admin dashboard subscribes; receives all card-tap events
//   settings        — broadcast settings updates to any interested client
@WebSocketGateway({ cors: true, path: '/socket.io' })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  handleConnection(socket: Socket) {
    this.logger.debug(`ws connect ${socket.id}`);
  }
  handleDisconnect(socket: Socket) {
    this.logger.debug(`ws disconnect ${socket.id}`);
  }

  @SubscribeMessage('gate:join')
  onGateJoin(@ConnectedSocket() socket: Socket, @MessageBody() body: { gateId: string }) {
    if (!body?.gateId) return { ok: false };
    socket.join(this.gateRoom(body.gateId));
    return { ok: true };
  }

  @SubscribeMessage('admin:join')
  onAdminJoin(@ConnectedSocket() socket: Socket) {
    socket.join('events');
    socket.join('settings');
    return { ok: true };
  }

  broadcastCardTap(payload: {
    id: string;
    at: string;
    gateId: string;
    gateCode: string;
    cardUid: string;
    result: string;
    reason: string | null;
    driverPublicId: string | null;
    plate: string | null;
    granted: boolean;
  }) {
    // Both the per-gate room (for the monitor display) and the global events
    // room (for the admin dashboard) get the same payload.
    this.server.to(this.gateRoom(payload.gateId)).emit('tap', payload);
    this.server.to('events').emit('tap', payload);
  }

  broadcastGateCommand(
    gateId: string,
    payload: { command: 'OPEN_GATE'; tapEventId: string | null; plate?: string },
  ) {
    this.server.to(this.gateRoom(gateId)).emit('command', payload);
  }

  broadcastSettingChange(key: string, value: unknown) {
    this.server.to('settings').emit('setting:changed', { key, value });
  }

  private gateRoom(gateId: string) {
    return `gate:${gateId}`;
  }
}
