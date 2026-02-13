import { IsEnum } from 'class-validator';

export enum ViolationPenaltyChoice {
    CREDITS = 'CREDITS',
    SOCIAL_SCORE = 'SOCIAL_SCORE',
}

export class ChooseViolationPenaltyDto {
    @IsEnum(ViolationPenaltyChoice)
    choice: ViolationPenaltyChoice;
}
