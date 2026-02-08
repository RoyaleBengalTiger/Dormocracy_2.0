import { IsString, IsOptional } from 'class-validator';

export class ResolveBreachCaseDto {
    @IsOptional()
    @IsString()
    resolutionNote?: string;
}
