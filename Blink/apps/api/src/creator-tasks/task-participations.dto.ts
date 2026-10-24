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
