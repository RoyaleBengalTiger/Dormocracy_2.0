import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AllocateFundsDto } from './dto/allocate-funds.dto';
import { RecallFundsDto } from './dto/recall-funds.dto';
import { CreateSocialScoreRequestDto } from './dto/create-social-score-request.dto';
import { OfferSocialScoreDto } from './dto/offer-social-score.dto';

@UseGuards(JwtAuthGuard)
@Controller('finance')
export class FinanceController {
    constructor(private readonly financeService: FinanceService) { }

    // ─── Treasury Overview ─────────────────────────────────────────

    @Get('overview')
    getOverview(@Req() req: any) {
        return this.financeService.getOverview(req.user.sub, req.user.role);
    }

    /** Mayor endpoint: view room treasury + spending history. */
    @Get('room-treasury')
    getRoomTreasury(@Req() req: any) {
        return this.financeService.getRoomTreasury(req.user.sub);
    }

    // ─── Allocate / Recall ─────────────────────────────────────────

    @Post('rooms/:roomId/allocate')
    allocateToRoom(
        @Param('roomId') roomId: string,
        @Body() dto: AllocateFundsDto,
        @Req() req: any,
    ) {
        return this.financeService.allocateToRoom(
            roomId,
            dto,
            req.user.sub,
            req.user.role,
        );
    }

    @Post('rooms/:roomId/recall')
    recallFromRoom(
        @Param('roomId') roomId: string,
        @Body() dto: RecallFundsDto,
        @Req() req: any,
    ) {
        return this.financeService.recallFromRoom(
            roomId,
            dto,
            req.user.sub,
            req.user.role,
        );
    }

    // ─── Transactions ──────────────────────────────────────────────

    @Get('transactions')
    getTransactions(
        @Req() req: any,
        @Query('limit') limit?: string,
    ) {
        return this.financeService.getTransactions(
            req.user.sub,
            req.user.role,
            limit ? parseInt(limit, 10) : 50,
        );
    }

    // ─── Social Score Purchase ─────────────────────────────────────

    @Post('social-score/requests')
    createSocialScoreRequest(
        @Body() dto: CreateSocialScoreRequestDto,
        @Req() req: any,
    ) {
        return this.financeService.createSocialScoreRequest(req.user.sub, dto);
    }

    /** PM endpoint: view requests for the department. */
    @Get('social-score/requests')
    getSocialScoreRequests(
        @Req() req: any,
        @Query('status') status?: string,
    ) {
        return this.financeService.getSocialScoreRequests(
            req.user.sub,
            req.user.role,
            status,
        );
    }

    /** User endpoint: view own requests. */
    @Get('social-score/my-requests')
    getMySocialScoreRequests(@Req() req: any) {
        return this.financeService.getMySocialScoreRequests(req.user.sub);
    }

    /** PM makes an offer. */
    @Patch('social-score/requests/:id/offer')
    offerSocialScore(
        @Param('id') id: string,
        @Body() dto: OfferSocialScoreDto,
        @Req() req: any,
    ) {
        return this.financeService.offerSocialScore(
            id,
            dto,
            req.user.sub,
            req.user.role,
        );
    }

    /** User accepts offer. */
    @Patch('social-score/requests/:id/accept')
    acceptOffer(@Param('id') id: string, @Req() req: any) {
        return this.financeService.acceptSocialScoreOffer(id, req.user.sub);
    }

    /** User rejects offer. */
    @Patch('social-score/requests/:id/reject')
    rejectOffer(@Param('id') id: string, @Req() req: any) {
        return this.financeService.rejectSocialScoreOffer(id, req.user.sub);
    }
}
