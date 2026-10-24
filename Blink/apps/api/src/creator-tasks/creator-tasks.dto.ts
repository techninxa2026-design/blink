import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional,
  IsString, IsNumber, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { CreatorTaskStatus } from '@prisma/client';

export class ChecklistDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(240, { each: true })
  items!: string[];
}

export class SaveTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(5)
  rewardBp?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  imageIds?: string[];

  @IsEnum(CreatorTaskStatus)
  status!: CreatorTaskStatus;

  @IsOptional()
  @IsString()
  videoUploadId?: string | null;

  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => ChecklistDto)
  checklists!: ChecklistDto[];
}

export class StartVideoDto {
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
