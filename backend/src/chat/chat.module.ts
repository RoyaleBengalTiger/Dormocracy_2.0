import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';

/**
 * ChatModule
 * Room chat v1: one chatroom per room.
 */
@Module({
    imports: [
        PrismaModule,
        JwtModule.register({}), // if your AuthModule already exports JwtModule, import AuthModule instead
    ],
    controllers: [ChatController],
    providers: [ChatService, ChatGateway],
})
export class ChatModule { }
