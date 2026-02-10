import { IsEnum } from 'class-validator';

export enum RespondAction {
    ACCEPT = 'ACCEPT',
    REJECT = 'REJECT',
}

export class RespondDepartmentDto {
    @IsEnum(RespondAction)
    action: RespondAction;
}
