import { IsNotEmpty, IsString } from 'class-validator';

export class AssignMinistersDto {
    @IsString()
    @IsNotEmpty()
    foreignMinisterId: string;

    @IsString()
    @IsNotEmpty()
    financeMinisterId: string;
}
