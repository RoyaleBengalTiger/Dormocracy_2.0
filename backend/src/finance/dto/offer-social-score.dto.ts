import { IsInt, Min } from 'class-validator';

export class OfferSocialScoreDto {
    @IsInt()
    @Min(1, { message: 'Price must be at least 1 credit' })
    offeredPriceCredits: number;

    @IsInt()
    @Min(1, { message: 'Social score amount must be at least 1' })
    offeredSocialScore: number;
}
