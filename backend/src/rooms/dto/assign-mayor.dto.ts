import { IsString } from 'class-validator';

/**
 * AssignMayorDto
 *
 * Used by ADMIN to assign a mayor to a specific room.
 * This is room-scoped leadership assignment (not just a user role flip).
 */
export class AssignMayorDto {
    @IsString()
    userId!: string;
}
