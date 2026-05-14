import { IsString, MaxLength, MinLength } from 'class-validator';

// Mensagens privadas podem ser um pouco maiores que comentarios publicos,
// mas continuam limitadas para manter a API previsivel.
export class CreateMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;
}
