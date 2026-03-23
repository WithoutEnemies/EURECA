import { IsEmail, IsString, MinLength } from 'class-validator';

// DTO = formato esperado para o cadastro.
// As anotacoes abaixo servem para validar a entrada automaticamente.
export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}
