import { IsString, IsInt, Min, MinLength, IsOptional, IsDateString, IsEnum } from 'class-validator';

export enum ViolationPenaltyModeDto {
    BOTH_MANDATORY = 'BOTH_MANDATORY',
    EITHER_CHOICE = 'EITHER_CHOICE',
}

export class CreateViolationDto {
    @IsString()
    offenderId: string;

    @IsString()
    @MinLength(2)
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsInt()
    @Min(0)
    points: number;

    /** Credit fine amount (D1) */
    @IsOptional()
    @IsInt()
    @Min(0)
    creditFine?: number;

    /** Penalty mode: BOTH_MANDATORY (default) or EITHER_CHOICE (D1) */
    @IsOptional()
    @IsEnum(ViolationPenaltyModeDto)
    penaltyMode?: ViolationPenaltyModeDto;

    /** Optional ISO date string; if set, violation auto-expires after this time. */
    @IsOptional()
    @IsDateString()
    expiresAt?: string;
}
