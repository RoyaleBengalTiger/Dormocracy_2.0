import { IsOptional, IsString } from 'class-validator';

export class AppealViolationDto {
    @IsOptional()
    @IsString()
    note?: string;
}
