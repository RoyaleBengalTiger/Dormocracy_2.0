import { IsString, MinLength, IsEnum, IsInt, Min, IsOptional } from 'class-validator';
import { ExchangeType } from '@prisma/client';

export class CreateExchangeDto {
    @IsString()
    @MinLength(2)
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsEnum(ExchangeType)
    type: ExchangeType;

    @IsInt()
    @Min(1)
    bounty: number;
}
