import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ReviewTaskDto {
    @IsBoolean()
    accept: boolean;

    @IsOptional()
    @IsString()
    note?: string;
}
