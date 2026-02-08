import { IsString, IsOptional } from 'class-validator';

export class DeliverExchangeDto {
    @IsOptional()
    @IsString()
    deliveryNotes?: string;
}
