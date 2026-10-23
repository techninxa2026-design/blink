import { IsBoolean, IsString, MinLength, MaxLength } from 'class-validator';
export class CreateBusinessRequestDto { @IsString() @MinLength(1) @MaxLength(191) profileId!: string; }
export class RespondBusinessRequestDto { @IsBoolean() accept!: boolean; }
