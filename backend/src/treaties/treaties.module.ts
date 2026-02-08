import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TreatiesService } from './treaties.service';
import { TreatiesController } from './treaties.controller';

@Module({
    imports: [PrismaModule],
    controllers: [TreatiesController],
    providers: [TreatiesService],
    exports: [TreatiesService],
})
export class TreatiesModule { }
