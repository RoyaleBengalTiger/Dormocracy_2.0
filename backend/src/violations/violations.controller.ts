import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { Role, ViolationStatus } from '@prisma/client';

import { ViolationsService } from './violations.service';
import { CreateViolationDto } from './dto/create-violation.dto';
import { AppealViolationDto } from './dto/appeal-violation.dto';
import { CloseEvaluationDto } from './dto/close-evaluation.dto';
import { AddCaseChatMemberDto } from './dto/add-case-chat-member.dto';
import { ChooseViolationPenaltyDto } from './dto/choose-violation-penalty.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SendMessageDto } from '../chat/dto/send-message.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('violations')
export class ViolationsController {
    constructor(private readonly violations: ViolationsService) { }

    // ─── POST /violations ────────────────────────────────────────
    @Roles(Role.MAYOR, Role.ADMIN)
    @Post()
    create(@Body() dto: CreateViolationDto, @Req() req: any) {
        return this.violations.create(dto, req.user.sub);
    }

    // ─── GET /violations ─────────────────────────────────────────
    @Get()
    findAll(
        @Req() req: any,
        @Query('offenderId') offenderId?: string,
        @Query('status') status?: ViolationStatus,
    ) {
        return this.violations.findAll(req.user.sub, offenderId, status);
    }

    // ─── POST /violations/:id/appeal ─────────────────────────────
    @Post(':id/appeal')
    appeal(
        @Param('id') id: string,
        @Body() dto: AppealViolationDto,
        @Req() req: any,
    ) {
        return this.violations.appeal(id, req.user.sub, dto);
    }

    // ─── GET /violations/appeals (PM inbox) ──────────────────────
    @Get('appeals')
    getAppeals(@Req() req: any) {
        return this.violations.getAppeals(req.user.sub);
    }

    // ─── GET /violations/invited ─────────────────────────────────
    @Get('invited')
    getInvited(@Req() req: any) {
        return this.violations.getInvited(req.user.sub);
    }

    // ─── GET /violations/:id ─────────────────────────────────────
    @Get(':id')
    findOne(@Param('id') id: string, @Req() req: any) {
        return this.violations.findOne(id, req.user.sub);
    }

    // ─── POST /violations/:id/start-evaluation ───────────────────
    @Post(':id/start-evaluation')
    startEvaluation(@Param('id') id: string, @Req() req: any) {
        return this.violations.startEvaluation(id, req.user.sub);
    }

    // ─── POST /violations/:id/choose-penalty (D2) ────────────────
    @Post(':id/choose-penalty')
    choosePenalty(
        @Param('id') id: string,
        @Body() dto: ChooseViolationPenaltyDto,
        @Req() req: any,
    ) {
        return this.violations.choosePenalty(id, req.user.sub, dto);
    }

    // ─── GET /violations/:id/chat ────────────────────────────────
    @Get(':id/chat')
    getCaseChat(
        @Param('id') id: string,
        @Req() req: any,
        @Query('limit') limit?: string,
        @Query('cursor') cursor?: string,
    ) {
        const take = limit ? Math.min(Number(limit), 100) : 50;
        return this.violations.getCaseChatMessages(id, req.user.sub, take, cursor);
    }

    // ─── POST /violations/:id/chat (send message) ────────────────
    @Post(':id/chat')
    sendCaseChatMessage(
        @Param('id') id: string,
        @Body() dto: SendMessageDto,
        @Req() req: any,
    ) {
        return this.violations.sendCaseChatMessage(id, req.user.sub, dto.content);
    }

    // ─── GET /violations/:id/chat/members ────────────────────────
    @Get(':id/chat/members')
    getCaseChatMembers(@Param('id') id: string, @Req() req: any) {
        return this.violations.getCaseChatMembers(id, req.user.sub);
    }

    // ─── POST /violations/:id/chat/members ───────────────────────
    @Post(':id/chat/members')
    addCaseChatMember(
        @Param('id') id: string,
        @Body() dto: AddCaseChatMemberDto,
        @Req() req: any,
    ) {
        return this.violations.addCaseChatMember(id, req.user.sub, dto.userId);
    }

    // ─── DELETE /violations/:id/chat/members/:userId ─────────────
    @Delete(':id/chat/members/:userId')
    kickCaseChatMember(
        @Param('id') id: string,
        @Param('userId') userId: string,
        @Req() req: any,
    ) {
        return this.violations.kickCaseChatMember(id, req.user.sub, userId);
    }

    // ─── POST /violations/:id/close-evaluation ───────────────────
    @Post(':id/close-evaluation')
    closeEvaluation(
        @Param('id') id: string,
        @Body() dto: CloseEvaluationDto,
        @Req() req: any,
    ) {
        return this.violations.closeEvaluation(id, req.user.sub, dto);
    }
}
