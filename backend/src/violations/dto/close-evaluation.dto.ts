import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ViolationVerdict } from '@prisma/client';

export class CloseEvaluationDto {
    @IsEnum(ViolationVerdict)
    verdict: ViolationVerdict;

    @IsOptional()
    @IsString()
    verdictNote?: string;

    /**
     * Required when verdict = PUNISH_MAYOR.
     * Points to deduct from the mayor who issued the violation.
     */
    @IsOptional()
    @IsInt()
    @Min(1)
    mayorPenaltyPoints?: number;

    /**
     * Required when verdict = PUNISH_MAYOR.
     * Title for the violation created against the mayor.
     */
    @IsOptional()
    @IsString()
    @MinLength(2)
    mayorPenaltyTitle?: string;
}
