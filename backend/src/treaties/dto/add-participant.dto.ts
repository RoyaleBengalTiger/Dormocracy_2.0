import { IsString } from 'class-validator';

export class AddRoomParticipantDto {
    @IsString()
    roomId: string;
}

export class AddUserParticipantDto {
    @IsString()
    userId: string;
}
