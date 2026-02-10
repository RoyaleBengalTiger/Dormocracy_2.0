import { IsString, MinLength, IsEnum, IsDateString, IsArray, ArrayMinSize } from 'class-validator';
import { TreatyType } from '@prisma/client';

export class CreateInterDeptTreatyDto {
    @IsString()
    @MinLength(2)
    title: string;

    @IsEnum(TreatyType)
    type: TreatyType;

    @IsDateString()
    endsAt: string;

    @IsArray()
    @ArrayMinSize(1)
    @IsString({ each: true })
    departmentIds: string[];
}
