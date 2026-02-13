import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ViolationsService } from './violations.service';

/**
 * ViolationExpiryService
 *
 * Scheduled job that runs every minute to archive expired violations
 * and refund socialScore points idempotently.
 */
@Injectable()
export class ViolationExpiryService {
    private readonly logger = new Logger(ViolationExpiryService.name);

    constructor(private readonly violations: ViolationsService) { }

    @Cron(CronExpression.EVERY_MINUTE)
    async handleExpiry() {
        try {
            const result = await this.violations.processExpiredViolations();
            if (result.processed > 0) {
                this.logger.log(`Expired ${result.processed} violation(s)`);
            }
        } catch (err) {
            this.logger.error('Violation expiry job failed', err);
        }
    }
}
