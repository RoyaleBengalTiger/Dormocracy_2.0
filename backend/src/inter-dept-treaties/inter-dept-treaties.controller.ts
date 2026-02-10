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
import { InterDeptTreatiesService } from './inter-dept-treaties.service';
import { CreateInterDeptTreatyDto } from './dto/create-inter-dept-treaty.dto';
import { InviteDepartmentDto } from './dto/invite-department.dto';
import { RespondDepartmentDto } from './dto/respond-department.dto';
import { AddRoomParticipantDto, AddUserParticipantDto } from './dto/add-participant.dto';
import { CreateClauseDto } from './dto/create-clause.dto';
import { CreateInterDeptBreachCaseDto } from './dto/create-breach-case.dto';
import { ProposeVerdictDto } from './dto/propose-verdict.dto';
import { VoteVerdictDto } from './dto/vote-verdict.dto';

@Controller('inter-dept-treaties')
@UseGuards(JwtAuthGuard)
export class InterDeptTreatiesController {
    constructor(private readonly service: InterDeptTreatiesService) { }

    // ─── Treaty CRUD ─────────────────────────────────────────────

    @Post()
    create(@Body() dto: CreateInterDeptTreatyDto, @Req() req: any) {
        return this.service.create(dto, req.user.sub);
    }

    @Get()
    findAll(@Req() req: any) {
        return this.service.findAll(req.user.sub);
    }

    // ─── Departments ─────────────────────────────────────────────

    @Get('meta/departments')
    listDepartments() {
        return this.service.listDepartments();
    }

    @Get(':id/stakeholders')
    listStakeholders(@Param('id') id: string, @Req() req: any) {
        return this.service.listStakeholders(id, req.user.sub);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Req() req: any) {
        return this.service.findOne(id, req.user.sub);
    }

    @Post(':id/departments/invite')
    inviteDepartment(
        @Param('id') id: string,
        @Body() dto: InviteDepartmentDto,
        @Req() req: any,
    ) {
        return this.service.inviteDepartment(id, req.user.sub, dto.departmentId);
    }

    @Patch(':id/departments/:departmentId/respond')
    respondDepartment(
        @Param('id') id: string,
        @Param('departmentId') departmentId: string,
        @Body() dto: RespondDepartmentDto,
        @Req() req: any,
    ) {
        return this.service.respondDepartment(id, departmentId, req.user.sub, dto.action);
    }

    // ─── Participants ────────────────────────────────────────────

    @Post(':id/participants/rooms')
    addRoomParticipant(
        @Param('id') id: string,
        @Body() dto: AddRoomParticipantDto,
        @Req() req: any,
    ) {
        return this.service.addRoomParticipant(id, req.user.sub, dto.roomId);
    }

    @Post(':id/participants/users')
    addUserParticipant(
        @Param('id') id: string,
        @Body() dto: AddUserParticipantDto,
        @Req() req: any,
    ) {
        return this.service.addUserParticipant(id, req.user.sub, dto.userId);
    }

    @Delete(':id/participants/rooms/:roomId')
    removeRoomParticipant(
        @Param('id') id: string,
        @Param('roomId') roomId: string,
        @Req() req: any,
    ) {
        return this.service.removeRoomParticipant(id, req.user.sub, roomId);
    }

    @Delete(':id/participants/users/:userId')
    removeUserParticipant(
        @Param('id') id: string,
        @Param('userId') userId: string,
        @Req() req: any,
    ) {
        return this.service.removeUserParticipant(id, req.user.sub, userId);
    }

    // ─── Candidates ──────────────────────────────────────────────

    @Get(':id/candidates/rooms')
    getRoomCandidates(@Param('id') id: string, @Req() req: any) {
        return this.service.getRoomCandidates(id, req.user.sub);
    }

    @Get(':id/candidates/users')
    getUserCandidates(@Param('id') id: string, @Req() req: any) {
        return this.service.getUserCandidates(id, req.user.sub);
    }

    // ─── Clauses ─────────────────────────────────────────────────

    @Get(':id/clauses')
    getClauses(@Param('id') id: string, @Req() req: any) {
        return this.service.getClauses(id, req.user.sub);
    }

    @Post(':id/clauses')
    addClause(
        @Param('id') id: string,
        @Body() dto: CreateClauseDto,
        @Req() req: any,
    ) {
        return this.service.addClause(id, req.user.sub, dto);
    }

    @Patch(':id/clauses/:clauseId')
    updateClause(
        @Param('id') id: string,
        @Param('clauseId') clauseId: string,
        @Body() dto: CreateClauseDto,
        @Req() req: any,
    ) {
        return this.service.updateClause(id, clauseId, req.user.sub, dto);
    }

    @Delete(':id/clauses/:clauseId')
    deleteClause(
        @Param('id') id: string,
        @Param('clauseId') clauseId: string,
        @Req() req: any,
    ) {
        return this.service.deleteClause(id, clauseId, req.user.sub);
    }

    @Post(':id/clauses/:clauseId/lock')
    lockClause(
        @Param('id') id: string,
        @Param('clauseId') clauseId: string,
        @Req() req: any,
    ) {
        return this.service.lockClause(id, clauseId, req.user.sub);
    }

    @Post(':id/clauses/:clauseId/unlock')
    unlockClause(
        @Param('id') id: string,
        @Param('clauseId') clauseId: string,
        @Req() req: any,
    ) {
        return this.service.unlockClause(id, clauseId, req.user.sub);
    }

    // ─── Chat ────────────────────────────────────────────────────

    @Get(':id/chat')
    getChatMessages(
        @Param('id') id: string,
        @Req() req: any,
        @Query('limit') limit?: string,
        @Query('cursor') cursor?: string,
    ) {
        return this.service.getChatMessages(id, req.user.sub, limit ? +limit : 50, cursor);
    }

    @Post(':id/chat')
    sendChatMessage(
        @Param('id') id: string,
        @Body() body: { content: string },
        @Req() req: any,
    ) {
        return this.service.sendChatMessage(id, req.user.sub, body.content);
    }

    // ─── Advance / Accept / Reject / Leave ──────────────────────

    @Post(':id/advance')
    advance(@Param('id') id: string, @Req() req: any) {
        return this.service.advance(id, req.user.sub);
    }

    @Post(':id/accept')
    acceptParticipation(@Param('id') id: string, @Req() req: any) {
        return this.service.acceptParticipation(id, req.user.sub);
    }

    @Post(':id/reject')
    rejectParticipation(@Param('id') id: string, @Req() req: any) {
        return this.service.rejectParticipation(id, req.user.sub);
    }

    @Post(':id/leave')
    leaveTreaty(@Param('id') id: string, @Req() req: any) {
        return this.service.leaveTreaty(id, req.user.sub);
    }

    @Get(':id/breaches')
    listBreaches(@Param('id') id: string, @Req() req: any) {
        return this.service.listBreaches(id, req.user.sub);
    }

    @Post(':id/breaches')
    createBreach(
        @Param('id') id: string,
        @Body() dto: CreateInterDeptBreachCaseDto,
        @Req() req: any,
    ) {
        return this.service.createBreach(id, req.user.sub, dto);
    }

    // ─── Breach Verdicts ─────────────────────────────────────────

    @Post(':treatyId/breaches/:breachId/verdicts')
    proposeVerdict(
        @Param('treatyId') treatyId: string,
        @Param('breachId') breachId: string,
        @Body() dto: ProposeVerdictDto,
        @Req() req: any,
    ) {
        return this.service.proposeVerdict(treatyId, breachId, req.user.sub, dto);
    }

    @Post('breach-verdicts/:verdictId/vote')
    voteVerdict(
        @Param('verdictId') verdictId: string,
        @Body() dto: VoteVerdictDto,
        @Req() req: any,
    ) {
        return this.service.voteVerdict(verdictId, req.user.sub, dto);
    }

    // ─── Breach Chat ─────────────────────────────────────────────

    @Get(':id/breaches/:breachId/chat')
    getBreachChatMessages(
        @Param('id') id: string,
        @Param('breachId') breachId: string,
        @Req() req: any,
        @Query('limit') limit?: string,
        @Query('cursor') cursor?: string,
    ) {
        return this.service.getBreachChatMessages(id, breachId, req.user.sub, limit ? +limit : 50, cursor);
    }

    @Post(':id/breaches/:breachId/chat')
    sendBreachChatMessage(
        @Param('id') id: string,
        @Param('breachId') breachId: string,
        @Body() body: { content: string },
        @Req() req: any,
    ) {
        return this.service.sendBreachChatMessage(id, breachId, req.user.sub, body.content);
    }
}
