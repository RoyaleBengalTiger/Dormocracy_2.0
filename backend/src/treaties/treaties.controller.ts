import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TreatiesService } from './treaties.service';
import { CreateTreatyDto } from './dto/create-treaty.dto';
import { CreateClauseDto } from './dto/create-clause.dto';
import { AddRoomParticipantDto, AddUserParticipantDto } from './dto/add-participant.dto';
import { CreateExchangeDto } from './dto/create-exchange.dto';
import { DeliverExchangeDto } from './dto/deliver-exchange.dto';
import { ReviewExchangeDto } from './dto/review-exchange.dto';
import { CreateBreachCaseDto } from './dto/create-breach-case.dto';
import { ResolveBreachCaseDto } from './dto/resolve-breach-case.dto';
import { RuleBreachCaseDto } from './dto/rule-breach-case.dto';
import { ChooseBreachPenaltyDto } from './dto/choose-breach-penalty.dto';
import { CreateBreachCompensationDto } from './dto/create-breach-compensation.dto';
import { AddUserParticipantDto as AddChatMemberDto } from './dto/add-participant.dto';
import { SendMessageDto } from '../chat/dto/send-message.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('treaties')
export class TreatiesController {
    constructor(private readonly treaties: TreatiesService) { }

    // ─── TREATY CRUD + LIFECYCLE ─────────────────────────────────

    @Post()
    create(@Body() dto: CreateTreatyDto, @Req() req: any) {
        return this.treaties.create(dto, req.user.sub);
    }

    @Get()
    findAll(@Req() req: any) {
        return this.treaties.findAll(req.user.sub);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Req() req: any) {
        return this.treaties.findOne(id, req.user.sub);
    }

    @Post(':id/advance')
    advance(@Param('id') id: string, @Req() req: any) {
        return this.treaties.advance(id, req.user.sub);
    }

    // ─── PARTICIPANTS (PM, NEGOTIATION only) ─────────────────────

    @Get(':id/candidates/users')
    getUserCandidates(@Param('id') id: string, @Req() req: any) {
        return this.treaties.getUserCandidates(id, req.user.sub);
    }

    @Post(':id/participants/rooms')
    addRoomParticipant(
        @Param('id') id: string,
        @Body() dto: AddRoomParticipantDto,
        @Req() req: any,
    ) {
        return this.treaties.addRoomParticipant(id, req.user.sub, dto.roomId);
    }

    @Post(':id/participants/users')
    addUserParticipant(
        @Param('id') id: string,
        @Body() dto: AddUserParticipantDto,
        @Req() req: any,
    ) {
        return this.treaties.addUserParticipant(id, req.user.sub, dto.userId);
    }

    @Delete(':id/participants/rooms/:roomId')
    removeRoomParticipant(
        @Param('id') id: string,
        @Param('roomId') roomId: string,
        @Req() req: any,
    ) {
        return this.treaties.removeRoomParticipant(id, req.user.sub, roomId);
    }

    @Delete(':id/participants/users/:userId')
    removeUserParticipant(
        @Param('id') id: string,
        @Param('userId') userId: string,
        @Req() req: any,
    ) {
        return this.treaties.removeUserParticipant(id, req.user.sub, userId);
    }

    // ─── LEAVE (LOCKED only) ─────────────────────────────────────

    @Post(':id/leave')
    leave(@Param('id') id: string, @Req() req: any) {
        return this.treaties.leaveTreaty(id, req.user.sub);
    }

    @Post(':id/leave-room')
    leaveRoom(
        @Param('id') id: string,
        @Body() body: { roomId: string },
        @Req() req: any,
    ) {
        return this.treaties.leaveRoomFromTreaty(id, req.user.sub, body.roomId);
    }

    // ─── CLAUSES ─────────────────────────────────────────────────

    @Post(':id/clauses')
    addClause(
        @Param('id') id: string,
        @Body() dto: CreateClauseDto,
        @Req() req: any,
    ) {
        return this.treaties.addClause(id, req.user.sub, dto);
    }

    @Patch(':id/clauses/:clauseId')
    updateClause(
        @Param('id') id: string,
        @Param('clauseId') clauseId: string,
        @Body() dto: CreateClauseDto,
        @Req() req: any,
    ) {
        return this.treaties.updateClause(id, clauseId, req.user.sub, dto);
    }

    @Delete(':id/clauses/:clauseId')
    deleteClause(
        @Param('id') id: string,
        @Param('clauseId') clauseId: string,
        @Req() req: any,
    ) {
        return this.treaties.deleteClause(id, clauseId, req.user.sub);
    }

    // ─── PARTICIPATION (LOCKED only) ─────────────────────────────

    @Post(':id/accept')
    accept(@Param('id') id: string, @Req() req: any) {
        return this.treaties.acceptParticipation(id, req.user.sub);
    }

    @Post(':id/reject')
    reject(@Param('id') id: string, @Req() req: any) {
        return this.treaties.rejectParticipation(id, req.user.sub);
    }

    // ─── TREATY CHAT ─────────────────────────────────────────────

    @Get(':id/chat')
    getChatMessages(
        @Param('id') id: string,
        @Req() req: any,
        @Query('limit') limit?: string,
        @Query('cursor') cursor?: string,
    ) {
        const take = limit ? Math.min(Number(limit), 100) : 50;
        return this.treaties.getChatMessages(id, req.user.sub, take, cursor);
    }

    @Post(':id/chat')
    sendChatMessage(
        @Param('id') id: string,
        @Body() dto: SendMessageDto,
        @Req() req: any,
    ) {
        return this.treaties.sendChatMessage(id, req.user.sub, dto.content);
    }

    // ─── EXCHANGES ───────────────────────────────────────────────

    @Get(':id/exchanges')
    listExchanges(@Param('id') id: string, @Req() req: any) {
        return this.treaties.listExchanges(id, req.user.sub);
    }

    @Post(':id/exchanges')
    createExchange(
        @Param('id') id: string,
        @Body() dto: CreateExchangeDto,
        @Req() req: any,
    ) {
        return this.treaties.createExchange(id, req.user.sub, dto);
    }

    @Post(':id/exchanges/:eid/accept')
    acceptExchange(
        @Param('id') id: string,
        @Param('eid') eid: string,
        @Req() req: any,
    ) {
        return this.treaties.acceptExchange(id, eid, req.user.sub);
    }

    @Post(':id/exchanges/:eid/deliver')
    deliverExchange(
        @Param('id') id: string,
        @Param('eid') eid: string,
        @Body() dto: DeliverExchangeDto,
        @Req() req: any,
    ) {
        return this.treaties.deliverExchange(id, eid, req.user.sub, dto);
    }

    @Post(':id/exchanges/:eid/review')
    reviewExchange(
        @Param('id') id: string,
        @Param('eid') eid: string,
        @Body() dto: ReviewExchangeDto,
        @Req() req: any,
    ) {
        return this.treaties.reviewExchange(id, eid, req.user.sub, dto);
    }

    // ─── STAKEHOLDERS ────────────────────────────────────────────

    @Get(':id/stakeholders')
    getStakeholders(@Param('id') id: string, @Req() req: any) {
        return this.treaties.getStakeholders(id, req.user.sub);
    }

    // ─── BREACH CASES ────────────────────────────────────────────

    @Get(':id/breaches')
    listBreachCases(@Param('id') id: string, @Req() req: any) {
        return this.treaties.listBreachCases(id, req.user.sub);
    }

    @Post(':id/breaches')
    createBreachCase(
        @Param('id') id: string,
        @Body() dto: CreateBreachCaseDto,
        @Req() req: any,
    ) {
        return this.treaties.createBreachCase(id, req.user.sub, dto);
    }

    @Post(':id/breaches/:bid/start-evaluation')
    startBreachEvaluation(
        @Param('id') id: string,
        @Param('bid') bid: string,
        @Req() req: any,
    ) {
        return this.treaties.startBreachEvaluation(id, bid, req.user.sub);
    }

    @Post(':id/breaches/:bid/chat-members')
    addBreachChatMember(
        @Param('id') id: string,
        @Param('bid') bid: string,
        @Body() dto: AddChatMemberDto,
        @Req() req: any,
    ) {
        return this.treaties.addBreachChatMember(id, bid, req.user.sub, dto.userId);
    }

    @Delete(':id/breaches/:bid/chat-members/:userId')
    removeBreachChatMember(
        @Param('id') id: string,
        @Param('bid') bid: string,
        @Param('userId') userId: string,
        @Req() req: any,
    ) {
        return this.treaties.removeBreachChatMember(id, bid, req.user.sub, userId);
    }

    @Post(':id/breaches/:bid/rule')
    ruleBreachCase(
        @Param('id') id: string,
        @Param('bid') bid: string,
        @Body() dto: RuleBreachCaseDto,
        @Req() req: any,
    ) {
        return this.treaties.ruleBreachCase(id, bid, req.user.sub, dto);
    }

    @Post(':id/breaches/:bid/choose-penalty')
    chooseBreachPenalty(
        @Param('id') id: string,
        @Param('bid') bid: string,
        @Body() dto: ChooseBreachPenaltyDto,
        @Req() req: any,
    ) {
        return this.treaties.chooseBreachPenalty(id, bid, req.user.sub, dto);
    }

    @Post(':id/breaches/:bid/compensations')
    createBreachCompensations(
        @Param('id') id: string,
        @Param('bid') bid: string,
        @Body() dto: CreateBreachCompensationDto,
        @Req() req: any,
    ) {
        return this.treaties.createBreachCompensations(id, bid, req.user.sub, dto);
    }

    // ─── BREACH CASE CHAT ────────────────────────────────────────

    @Get(':id/breaches/:bid/chat')
    getBreachChatMessages(
        @Param('id') id: string,
        @Param('bid') bid: string,
        @Req() req: any,
        @Query('limit') limit?: string,
        @Query('cursor') cursor?: string,
    ) {
        const take = limit ? Math.min(Number(limit), 100) : 50;
        return this.treaties.getBreachChatMessages(id, bid, req.user.sub, take, cursor);
    }

    @Post(':id/breaches/:bid/chat')
    sendBreachChatMessage(
        @Param('id') id: string,
        @Param('bid') bid: string,
        @Body() dto: SendMessageDto,
        @Req() req: any,
    ) {
        return this.treaties.sendBreachChatMessage(id, bid, req.user.sub, dto.content);
    }

    @Get(':id/breaches/:bid/chat-members')
    getBreachChatMembers(
        @Param('id') id: string,
        @Param('bid') bid: string,
        @Req() req: any,
    ) {
        return this.treaties.getBreachChatMembers(id, bid, req.user.sub);
    }
}

