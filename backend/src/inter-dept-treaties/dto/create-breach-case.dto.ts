import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateInterDeptBreachCaseDto {
    @IsString()
    accusedUserId: string;

    @IsArray()
    @IsString({ each: true })
    clauseIds: string[];

    @IsString()
    title: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    exchangeId?: string;
}
