import { IsBoolean } from 'class-validator';

export class ReviewExchangeDto {
    @IsBoolean()
    approve: boolean;
}
