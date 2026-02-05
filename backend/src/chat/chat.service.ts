import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * ChatService
 *
 * Handles chatroom discovery, membership enforcement, and message persistence.
 * v1: room chat only (1 chatroom per room).
 */
@Injectable()
export class ChatService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Get or create the chatroom for a given roomId.
     * This is a safety net (in case legacy rooms existed before chatrooms).
     */
    async getOrCreateRoomChat(roomId: string) {
        const existing = await this.prisma.chatRoom.findUnique({
            where: { roomId },
            select: { id: true, roomId: true, type: true },
        });

        if (existing) return existing;

        // Ensure room exists
        const room = await this.prisma.room.findUnique({ where: { id: roomId }, select: { id: true } });
        if (!room) throw new NotFoundException('Room not found');

        return this.prisma.chatRoom.create({
            data: { type: 'ROOM', roomId },
            select: { id: true, roomId: true, type: true },
        });
    }

    /**
     * Ensure the user belongs to the room that owns the chatroom.
     * v1 rule: User must be in the same room.
     */
    async assertRoomChatAccess(userId: string, chatRoomId: string) {
        const chat = await this.prisma.chatRoom.findUnique({
            where: { id: chatRoomId },
            select: { id: true, type: true, roomId: true },
        });
        if (!chat) throw new NotFoundException('Chatroom not found');
        if (chat.type !== 'ROOM' || !chat.roomId) throw new ForbiddenException('Invalid chatroom type');

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, roomId: true },
        });
        if (!user) throw new NotFoundException('User not found');

        if (user.roomId !== chat.roomId) {
            throw new ForbiddenException('You are not a member of this room chat');
        }

        return chat;
    }

    /**
     * Create and persist a message in a chatroom.
     */
    async sendMessage(userId: string, content: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, roomId: true },
        });
        if (!user) throw new NotFoundException('User not found');

        const chat = await this.getOrCreateRoomChat(user.roomId);

        // enforce access
        await this.assertRoomChatAccess(userId, chat.id);

        const msg = await this.prisma.chatMessage.create({
            data: {
                chatRoomId: chat.id,
                senderId: userId,
                content,
            },
            select: {
                id: true,
                content: true,
                createdAt: true,
                chatRoomId: true,
                sender: { select: { id: true, username: true, role: true } },
            },
        });

        return { chatRoomId: chat.id, message: msg };
    }

    /**
     * Cursor pagination for messages (newest-first).
     */
    async getRoomMessages(userId: string, limit = 30, cursor?: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, roomId: true },
        });
        if (!user) throw new NotFoundException('User not found');

        const chat = await this.getOrCreateRoomChat(user.roomId);
        await this.assertRoomChatAccess(userId, chat.id);

        const messages = await this.prisma.chatMessage.findMany({
            where: {
                chatRoomId: chat.id,
                deletedAt: null,
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: limit,
            ...(cursor
                ? {
                    cursor: { id: cursor },
                    skip: 1,
                }
                : {}),
            select: {
                id: true,
                content: true,
                createdAt: true,
                sender: { select: { id: true, username: true, role: true } },
            },
        });

        const nextCursor = messages.length ? messages[messages.length - 1].id : null;
        return { chatRoomId: chat.id, items: messages, nextCursor };
    }

    /**
     * Returns the room chatroom id for the current user.
     */
    async getMyRoomChat(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, roomId: true },
        });
        if (!user) throw new NotFoundException('User not found');

        return this.getOrCreateRoomChat(user.roomId);
    }
}
