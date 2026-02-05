import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * SendMessageDto
 * Payload for sending a message to the user's room chat.
 */
export class SendMessageDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(2000)
    content!: string;
}
