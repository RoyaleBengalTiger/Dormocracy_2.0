import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ViolationsService } from './violations.service';
import { ViolationsController } from './violations.controller';
import { ViolationExpiryService } from './violation-expiry.service';

@Module({
    imports: [ScheduleModule.forRoot()],
    controllers: [ViolationsController],
    providers: [ViolationsService, ViolationExpiryService],
})
export class ViolationsModule { }
