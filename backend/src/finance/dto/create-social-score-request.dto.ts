import { IsOptional, IsString } from 'class-validator';

export class CreateSocialScoreRequestDto {
    @IsOptional()
    @IsString()
    requestNote?: string;
}
