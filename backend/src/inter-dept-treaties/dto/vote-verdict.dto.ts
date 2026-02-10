import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum VoteAction {
    ACCEPT = 'ACCEPT',
    REJECT = 'REJECT',
}

export class VoteVerdictDto {
    @IsEnum(VoteAction)
    vote: VoteAction;

    @IsString()
    @IsOptional()
    comment?: string;
}
