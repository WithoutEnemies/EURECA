import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// Define o formato valido para criar um comentario em um post.
// Mantem o mesmo limite dos posts para preservar uma conversa curta e direta.
export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(280)
  content: string;

  @IsOptional()
  @IsString()
  parentCommentId?: string;
}
