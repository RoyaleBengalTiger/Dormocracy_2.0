import { IsString, MinLength } from 'class-validator';

export class CreateClauseDto {
    @IsString()
    @MinLength(1)
    content: string;
}
