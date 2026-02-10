import { IsString } from 'class-validator';

export class InviteDepartmentDto {
    @IsString()
    departmentId: string;
}
