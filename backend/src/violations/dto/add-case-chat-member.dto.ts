import { IsString } from 'class-validator';

export class AddCaseChatMemberDto {
    @IsString()
    userId: string;
}
