import { IsString, MinLength } from 'class-validator';

// Cria ou reutiliza uma conversa direta com outro usuario.
export class CreateConversationDto {
  @IsString()
  @MinLength(1)
  participantId: string;
}
