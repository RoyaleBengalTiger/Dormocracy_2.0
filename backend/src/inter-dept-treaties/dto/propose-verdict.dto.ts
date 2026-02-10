import { IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { BreachVerdictRuling, BreachVerdictPenaltyMode } from '@prisma/client';

export class ProposeVerdictDto {
    @IsEnum(BreachVerdictRuling)
    ruledAgainst: BreachVerdictRuling;

    @IsInt()
    @Min(0)
    creditFine: number;

    @IsInt()
    @Min(0)
    socialPenalty: number;

    @IsEnum(BreachVerdictPenaltyMode)
    penaltyMode: BreachVerdictPenaltyMode;

    @IsString()
    @IsOptional()
    notes?: string;
}
