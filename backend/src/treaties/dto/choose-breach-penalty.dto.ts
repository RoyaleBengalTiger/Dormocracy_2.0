import { IsEnum } from 'class-validator';

export enum CriminalChoiceValue {
    SOCIAL = 'SOCIAL',
    CREDITS = 'CREDITS',
}

export class ChooseBreachPenaltyDto {
    @IsEnum(CriminalChoiceValue)
    choice: CriminalChoiceValue;
}
