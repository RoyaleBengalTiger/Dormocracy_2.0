import { IsString, MinLength } from 'class-validator';

export class CreateRoomDto {
    @IsString()
    @MinLength(1)
    roomNumber: string;

    @IsString()
    departmentId: string;
}
