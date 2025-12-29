import { IsString } from 'class-validator';

export class AssignTaskDto {
    @IsString()
    assignedToId: string;
}
