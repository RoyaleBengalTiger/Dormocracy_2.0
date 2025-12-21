import { ConflictException, Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '@prisma/client';

type Tokens = { accessToken: string; refreshToken: string };

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
    ) { }

    private async signTokens(userId: string, email: string, role: Role): Promise<Tokens> {
        const accessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
        const refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');

        const accessTtl = Number(this.config.get<string>('JWT_ACCESS_TTL_SECONDS') ?? 900);
        const refreshTtl = Number(this.config.get<string>('JWT_REFRESH_TTL_SECONDS') ?? 2592000);

        const payload = { sub: userId, email, role };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwt.signAsync(payload, { secret: accessSecret, expiresIn: accessTtl }),
            this.jwt.signAsync(payload, { secret: refreshSecret, expiresIn: refreshTtl }),
        ]);

        return { accessToken, refreshToken };
    }

    private async setRefreshTokenHash(userId: string, refreshToken: string) {
        const hash = await argon2.hash(refreshToken);
        await this.prisma.user.update({
            where: { id: userId },
            data: { refreshTokenHash: hash },
        });
    }

    async register(dto: RegisterDto) {
        const department = await this.prisma.department.findUnique({
            where: { name: dto.departmentName },
        });

        if (!department) {
            throw new BadRequestException(`Department '${dto.departmentName}' does not exist`);
        }

        const passwordHash = await argon2.hash(dto.password);

        const user = await this.prisma.$transaction(async (tx) => {
            // 1) Find or create room
            const room = await tx.room.upsert({
                where: {
                    departmentId_roomNumber: {
                        departmentId: department.id,
                        roomNumber: dto.roomNumber,
                    },
                },
                update: {},
                create: {
                    departmentId: department.id,
                    roomNumber: dto.roomNumber,
                },
            });

            // 2) Ensure chatroom exists for that room (safe even if room existed)
            const chatRoom = await tx.chatRoom.upsert({
                where: { roomId: room.id },      // requires ChatRoom.roomId @unique
                update: {},
                create: {
                    type: 'ROOM',
                    roomId: room.id,
                },
            });

            // 3) Create user
            const createdUser = await tx.user.create({
                data: {
                    username: dto.username,
                    email: dto.email,
                    password: passwordHash,
                    role: Role.CITIZEN,
                    roomId: room.id,
                },
            });

            // 4) (Recommended) Create chat membership row
            await tx.chatRoomMember.create({
                data: {
                    chatRoomId: chatRoom.id,
                    userId: createdUser.id,
                },
            });

            return createdUser;
        });

        const tokens = await this.signTokens(user.id, user.email, user.role);
        await this.setRefreshTokenHash(user.id, tokens.refreshToken);

        return tokens;
    }


    async login(dto: LoginDto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user) throw new UnauthorizedException('Invalid credentials');

        const ok = await argon2.verify(user.password, dto.password);
        if (!ok) throw new UnauthorizedException('Invalid credentials');

        const tokens = await this.signTokens(user.id, user.email, user.role);
        await this.setRefreshTokenHash(user.id, tokens.refreshToken);

        return tokens;
    }

    async refresh(refreshToken: string) {
        const refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');

        // 1️⃣ Verify refresh token (signature + expiry)
        let payload: { sub: string; email: string; role: Role };
        try {
            payload = await this.jwt.verifyAsync(refreshToken, {
                secret: refreshSecret,
            });
        } catch {
            throw new UnauthorizedException('Invalid refresh token');
        }

        const userId = payload.sub;

        // 2️⃣ Load user and ensure refresh token exists
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.refreshTokenHash) {
            throw new UnauthorizedException('Access denied');
        }

        // 3️⃣ Compare refresh token with stored hash
        const ok = await argon2.verify(user.refreshTokenHash, refreshToken);
        if (!ok) {
            throw new UnauthorizedException('Access denied');
        }

        // 4️⃣ Rotate tokens
        const tokens = await this.signTokens(user.id, user.email, user.role);
        await this.setRefreshTokenHash(user.id, tokens.refreshToken);

        return tokens;
    }


    async logout(userId: string) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { refreshTokenHash: null },
        });
        return { success: true };
    }
}
