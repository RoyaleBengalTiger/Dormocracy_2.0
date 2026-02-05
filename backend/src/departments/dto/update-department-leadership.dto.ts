import { IsOptional, IsString } from 'class-validator';

export class UpdateDepartmentLeadershipDto {
    @IsOptional()
    @IsString()
    primeMinisterId?: string | null;

    @IsOptional()
    @IsString()
    foreignMinisterId?: string | null;

    @IsOptional()
    @IsString()
    financeMinisterId?: string | null;
}
