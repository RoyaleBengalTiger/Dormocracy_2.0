import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';

import { ElectionsService } from './elections.service';
import { CreateRoomElectionDto } from './dto/create-room-election.dto';
import { CreateDeptElectionDto } from './dto/create-dept-election.dto';
import { CastVoteDto } from './dto/cast-vote.dto';
import { ResolveTieDto } from './dto/resolve-tie.dto';
import { AssignMinistersDto } from './dto/assign-ministers.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('elections')
export class ElectionsController {
    constructor(private readonly electionsService: ElectionsService) { }

    // ─── Admin: Create Room Election ───────────────────────────────

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post('room')
    createRoomElection(@Body() dto: CreateRoomElectionDto) {
        return this.electionsService.createRoomElection(dto);
    }

    // ─── Admin: Create Department Election ─────────────────────────

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post('department')
    createDeptElection(@Body() dto: CreateDeptElectionDto) {
        return this.electionsService.createDeptElection(dto);
    }

    // ─── List Elections ────────────────────────────────────────────

    @UseGuards(JwtAuthGuard)
    @Get()
    listElections(
        @Query('roomId') roomId?: string,
        @Query('departmentId') departmentId?: string,
        @Query('status') status?: string,
    ) {
        return this.electionsService.listElections({
            roomId,
            departmentId,
            status,
        });
    }

    // ─── Senate Chat (MUST be before :id route) ──────────────────

    @UseGuards(JwtAuthGuard)
    @Get('senate/:departmentId')
    getSenateChatRoom(
        @Param('departmentId') departmentId: string,
        @Req() req: any,
    ) {
        return this.electionsService.getSenateChatRoom(departmentId, req.user.sub);
    }

    @UseGuards(JwtAuthGuard)
    @Get('senate/:departmentId/messages')
    getSenateMessages(
        @Param('departmentId') departmentId: string,
        @Req() req: any,
        @Query('limit') limit?: string,
        @Query('cursor') cursor?: string,
    ) {
        return this.electionsService.getSenateMessages(
            departmentId,
            req.user.sub,
            limit ? parseInt(limit, 10) : 30,
            cursor,
        );
    }

    @UseGuards(JwtAuthGuard)
    @Post('senate/:departmentId/messages')
    sendSenateMessage(
        @Param('departmentId') departmentId: string,
        @Body('content') content: string,
        @Req() req: any,
    ) {
        return this.electionsService.sendSenateMessage(
            departmentId,
            req.user.sub,
            content,
        );
    }

    // ─── Get Election Detail ───────────────────────────────────────

    @UseGuards(JwtAuthGuard)
    @Get(':id')
    getElection(@Param('id') id: string) {
        return this.electionsService.checkAndFinalizeIfNeeded(id);
    }

    // ─── Cast Vote ─────────────────────────────────────────────────

    @UseGuards(JwtAuthGuard)
    @Post(':id/vote')
    castVote(
        @Param('id') id: string,
        @Body() dto: CastVoteDto,
        @Req() req: any,
    ) {
        return this.electionsService.castVote(id, req.user.sub, dto);
    }

    // ─── Admin: Resolve Tie ────────────────────────────────────────

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post(':id/resolve-tie')
    resolveTie(@Param('id') id: string, @Body() dto: ResolveTieDto) {
        return this.electionsService.resolveTie(id, dto);
    }

    // ─── PM: Assign Ministers ──────────────────────────────────────

    @UseGuards(JwtAuthGuard)
    @Post(':departmentId/assign-ministers')
    assignMinisters(
        @Param('departmentId') departmentId: string,
        @Body() dto: AssignMinistersDto,
        @Req() req: any,
    ) {
        return this.electionsService.assignMinisters(
            departmentId,
            req.user.sub,
            dto,
        );
    }
}
