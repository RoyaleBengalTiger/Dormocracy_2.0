import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { InterDeptTreatiesService } from './inter-dept-treaties.service';
import { InterDeptTreatiesController } from './inter-dept-treaties.controller';

@Module({
    imports: [PrismaModule],
    controllers: [InterDeptTreatiesController],
    providers: [InterDeptTreatiesService],
    exports: [InterDeptTreatiesService],
})
export class InterDeptTreatiesModule { }
