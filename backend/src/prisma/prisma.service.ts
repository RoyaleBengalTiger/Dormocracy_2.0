import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * PrismaService
 *
 * Centralized Prisma client for NestJS.
 *
 * Key points:
 * - Uses Prisma v7 driver adapter for PostgreSQL (`@prisma/adapter-pg`).
 * - Connects on module init and disconnects on module destroy.
 * - Reads DATABASE_URL via ConfigService (cleaner & testable).
 *
 * NOTE:
 * Ensure ConfigModule.forRoot({ isGlobal: true }) is enabled in AppModule.
 */
@Injectable()
export class PrismaService
    extends PrismaClient
    implements OnModuleInit, OnModuleDestroy {
    constructor(private readonly config: ConfigService) {
        const databaseUrl = config.get<string>('DATABASE_URL');
        if (!databaseUrl) {
            throw new Error('DATABASE_URL is not set');
        }

        super({
            adapter: new PrismaPg({
                connectionString: databaseUrl,
            }),
        });
    }

    async onModuleInit(): Promise<void> {
        await this.$connect();
    }

    async onModuleDestroy(): Promise<void> {
        await this.$disconnect();
    }
}
