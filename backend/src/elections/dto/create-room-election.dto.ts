import { IsNotEmpty, IsString, IsDateString } from 'class-validator';

export class CreateRoomElectionDto {
    @IsString()
    @IsNotEmpty()
    roomId: string;

    @IsDateString()
    @IsNotEmpty()
    deadline: string;
}
