import { IsString, MinLength, IsArray, ArrayMinSize, IsOptional } from 'class-validator';

export class CreateBreachCaseDto {
    @IsString()
    accusedUserId: string;

    @IsArray()
    @ArrayMinSize(1)
    @IsString({ each: true })
    clauseIds: string[];

    @IsOptional()
    @IsString()
    exchangeId?: string;

    @IsString()
    @MinLength(2)
    title: string;

    @IsOptional()
    @IsString()
    description?: string;
}
