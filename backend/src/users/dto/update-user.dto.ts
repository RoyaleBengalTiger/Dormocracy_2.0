import { IsEmail, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * UpdateUserDto
 *
 * Admin update DTO:
 * - Can change roomId, socialScore, username/email (optional)
 * - Role is NOT editable here to prevent privilege/position escalation.
 */
export class UpdateUserDto {
    @IsOptional()
    @IsString()
    username?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    roomId?: string;

    @IsOptional()
    @IsInt()
    @Min(0)
    socialScore?: number;
}
