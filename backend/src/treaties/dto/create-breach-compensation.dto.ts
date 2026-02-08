import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CompensationEntry {
    @IsString()
    userId: string;

    @IsInt()
    @Min(1)
    amount: number;
}

export class CreateBreachCompensationDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CompensationEntry)
    compensations: CompensationEntry[];

    @IsOptional()
    @IsString()
    note?: string;
}
