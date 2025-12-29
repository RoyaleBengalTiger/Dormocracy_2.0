import { IsString } from 'class-validator';

export class ApproveAssignTaskDto {
    @IsString()
    assignedToId: string;
}
