import { IsNotEmpty, IsString } from 'class-validator';

export class ResolveTieDto {
    @IsString()
    @IsNotEmpty()
    winnerId: string;
}
