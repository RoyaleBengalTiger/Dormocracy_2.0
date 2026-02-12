import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RecallFundsDto {
    @IsInt()
    @Min(1, { message: 'Amount must be greater than 0' })
    amount: number;

    @IsOptional()
    @IsString()
    note?: string;
}
