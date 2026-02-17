import { IsNotEmpty, IsString, IsDateString } from 'class-validator';

export class CreateDeptElectionDto {
    @IsString()
    @IsNotEmpty()
    departmentId: string;

    @IsDateString()
    @IsNotEmpty()
    deadline: string;
}
