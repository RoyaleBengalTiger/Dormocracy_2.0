import { IsString, MinLength } from 'class-validator';

export class CompleteTaskDto {
    @IsString()
    @MinLength(5)
    completionSummary: string;
}
