import { IsString, MinLength, IsEnum, IsDateString } from 'class-validator';
import { TreatyType } from '@prisma/client';

export class CreateTreatyDto {
    @IsString()
    @MinLength(2)
    title: string;

    @IsEnum(TreatyType)
    type: TreatyType;

    @IsDateString()
    endsAt: string;
}
