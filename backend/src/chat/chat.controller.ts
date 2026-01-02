import { Body, Controller, Get, Query, Req, UseGuards, Post } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

/**
 * ChatController
 * REST endpoints for room chat.
 *
 * Even if you primarily use WebSockets, keep REST as a fallback.
 */
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) { }

    /**
     * Returns the chatroom for the current user's room.
     */
    @Get('room')
    getMyRoomChat(@Req() req: any) {
        return this.chatService.getMyRoomChat(req.user.sub);
    }

    /**
     * Get messages for the current user's room chat.
     * Cursor pagination: pass cursor=<messageId> to fetch older messages.
     */
    @Get('room/messages')
    getRoomMessages(
        @Req() req: any,
        @Query('limit') limit?: string,
        @Query('cursor') cursor?: string,
    ) {
        const take = limit ? Math.min(Number(limit), 100) : 30;
        return this.chatService.getRoomMessages(req.user.sub, take, cursor);
    }

    /**
     * Send a message to the current user's room chat (REST fallback).
     */
    @Post('room/messages')
    sendRoomMessage(@Req() req: any, @Body() dto: SendMessageDto) {
        return this.chatService.sendMessage(req.user.sub, dto.content);
    }
}
