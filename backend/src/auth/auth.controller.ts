import { Body, Controller, Post, Req, Res, UseGuards, UnauthorizedException } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * NOTE:
 * For refresh, we expect the client to send refreshToken in body.
 * Later, when frontend is ready, you can move refreshToken to httpOnly cookie.
 */
@Controller('auth')
export class AuthController {
    constructor(private readonly auth: AuthService) { }


private setRefreshCookie(reply: FastifyReply, refreshToken: string) {
  reply.setCookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: true,        // ✅ must be true for SameSite=None
    sameSite: 'none',    // ✅ required for cross-site cookies
    path: '/',           // ✅ easiest; or keep /auth/refresh if you prefer
    maxAge: 60 * 60 * 24 * 30,
  });
}

    private clearRefreshCookie(reply: FastifyReply) {
        reply.clearCookie('refresh_token', { path: '/' });
    }


    @Post('register')
    async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) reply: FastifyReply) {
        const tokens = await this.auth.register(dto);
        this.setRefreshCookie(reply, tokens.refreshToken);
        return { accessToken: tokens.accessToken };
    }


    @Post('login')
    async login(@Body() dto: LoginDto, @Res({ passthrough: true }) reply: FastifyReply) {
        const tokens = await this.auth.login(dto);
        this.setRefreshCookie(reply, tokens.refreshToken);
        return { accessToken: tokens.accessToken };
    }

    @Post('refresh')
    async refresh(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
        const refreshToken = (req.cookies as any)?.refresh_token;
        if (!refreshToken) throw new UnauthorizedException('Missing refresh token');

        const tokens = await this.auth.refresh(refreshToken);
        this.setRefreshCookie(reply, tokens.refreshToken);
        return { accessToken: tokens.accessToken };
    }

    @UseGuards(JwtAuthGuard)
    @Post('logout')
    async logout(@Req() req: any, @Res({ passthrough: true }) reply: FastifyReply) {
        await this.auth.logout(req.user.sub);
        this.clearRefreshCookie(reply);
        return { success: true };
    }

}
