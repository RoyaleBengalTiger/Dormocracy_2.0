import { IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator';

export enum RulingType {
    AGAINST_ACCUSED = 'AGAINST_ACCUSED',
    AGAINST_ACCUSER = 'AGAINST_ACCUSER',
    NONE = 'NONE',
}

export enum PenaltyMode {
    BOTH_MANDATORY = 'BOTH_MANDATORY',
    EITHER_CHOICE = 'EITHER_CHOICE',
}

export class RuleBreachCaseDto {
    @IsEnum(RulingType)
    rulingType: RulingType;

    @IsOptional()
    @IsEnum(PenaltyMode)
    penaltyMode?: PenaltyMode;

    @IsOptional()
    @IsInt()
    @Min(0)
    socialPenalty?: number;

    @IsOptional()
    @IsInt()
    @Min(0)
    creditFine?: number;

    @IsOptional()
    @IsString()
    resolutionNote?: string;
}
