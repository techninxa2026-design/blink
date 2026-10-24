import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

export class SaveParticipationDto {
  @IsString()
  @MaxLength(6000)
  explanation!: string;

  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  checkedItemIds!: string[];

  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  imageIds!: string[];
}

import { IsInt, IsNotEmpty, IsOptional, Min, Max } from 'class-validator';

export class SaveParticipationStepDto {
  @IsString()
  @MaxLength(6000)
  explanation!: string;

  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  imageIds!: string[];

  @IsOptional()
  @IsString()
  videoUploadId?: string | null;
}

export class StartParticipationVideoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename!: string;

  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @IsInt()
  @Min(1)
  totalBytes!: number;
}
