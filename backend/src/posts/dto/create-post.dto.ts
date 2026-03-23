import { IsString, MaxLength, MinLength } from 'class-validator';

// Define o formato valido para criar um post.
// O texto precisa existir e nao pode passar de 280 caracteres.
export class CreatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(280)
  content: string;
}
