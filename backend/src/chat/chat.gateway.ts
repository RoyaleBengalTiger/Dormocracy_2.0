import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * ChatGateway
 *
 * Socket.IO gateway for room chat.
 * Auth: expects JWT access token in `handshake.auth.token`.
 */
@WebSocketGateway({
    cors: { origin: true, credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    constructor(
        private readonly jwt: JwtService,
        private readonly prisma: PrismaService,
        private readonly chatService: ChatService,
    ) { }

    /**
     * On connect:
     * - verify token
     * - get user and room
     * - join socket room channel: `room-chat:<roomId>`
     */
    async handleConnection(client: Socket) {
        try {
            const token = client.handshake?.auth?.token;
            if (!token) throw new Error('Missing token');

            const payload: any = await this.jwt.verifyAsync(token);
            const userId = payload?.sub;

            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, roomId: true, username: true },
            });
            if (!user) throw new Error('User not found');

            client.data.userId = user.id;
            client.data.roomId = user.roomId;

            client.join(`room-chat:${user.roomId}`);
        } catch {
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket) {
        // no-op for now
    }

    /**
     * room:message
     * Creates message in DB and emits to everyone in the room.
     */
    @SubscribeMessage('room:message')
    async onRoomMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() body: { content: string },
    ) {
        const userId = client.data.userId as string;
        const roomId = client.data.roomId as string;
        if (!userId || !roomId) return;

        // Persist message (service enforces access)
        const { message } = await this.chatService.sendMessage(userId, body.content);

        this.server.to(`room-chat:${roomId}`).emit('room:new_message', message);

        return { ok: true };
    }
}
