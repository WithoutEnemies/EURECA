import { IsEmail, IsString, MinLength } from 'class-validator';

// DTO = formato esperado para o login.
// Se os dados nao seguirem essas regras, a requisicao sera rejeitada.
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}
