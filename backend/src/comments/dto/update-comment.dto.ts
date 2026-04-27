import { IsString, MaxLength, MinLength } from 'class-validator';

// Define o formato valido para editar um comentario existente.
export class UpdateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(280)
  content: string;
}
