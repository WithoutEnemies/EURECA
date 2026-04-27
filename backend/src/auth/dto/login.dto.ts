import { IsString, MinLength } from 'class-validator';

// DTO = formato esperado para o login.
// Se os dados nao seguirem essas regras, a requisicao sera rejeitada.
export class LoginDto {
  @IsString()
  @MinLength(3)
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}
