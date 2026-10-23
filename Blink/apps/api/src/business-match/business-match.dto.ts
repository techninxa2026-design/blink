import { IsBoolean, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { BusinessProfileType } from '@prisma/client';

export class SaveBusinessProfileDto {
  @IsEnum(BusinessProfileType) type!: BusinessProfileType;
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsString() @MinLength(1) @MaxLength(120) headline!: string;
  @IsString() @MinLength(1) @MaxLength(80) industry!: string;
  @IsOptional() @IsString() @MaxLength(100) location?: string;
  @IsOptional() @IsString() @MaxLength(240) skills?: string;
  @IsOptional() @IsString() @MaxLength(600) about?: string;
  @IsOptional() @IsString() @MaxLength(400) lookingFor?: string;
}

export class SetBusinessActivationDto {
  @IsBoolean() active!: boolean;
}

export class DiscoverBusinessProfilesDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsEnum(BusinessProfileType) type?: BusinessProfileType;
  @IsOptional() @IsString() @Matches(/^[1-9]\d{0,3}$/) page?: string;
}
