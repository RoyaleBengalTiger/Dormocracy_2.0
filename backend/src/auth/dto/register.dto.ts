import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
    @IsString()
    @MinLength(3)
    username: string;

    @IsEmail()
    email: string;

    @IsString()
    @MinLength(8)
    password: string;

    @IsString()
    departmentName: string;

    // room number as string (e.g. "101", "2A")
    @IsString()
    roomNumber: string;

}
