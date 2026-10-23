import { IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
export class CreateBusinessMeetingDto {
  @IsString() @IsNotEmpty() connectionId!: string;
  @IsString() @IsNotEmpty() @MaxLength(120) title!: string;
  @IsOptional() @IsString() @MaxLength(1000) agenda?: string;
  @IsOptional() @IsString() @MaxLength(300) location?: string;
  @IsISO8601({ strict: true }) startsAt!: string;
  @IsISO8601({ strict: true }) endsAt!: string;
}
