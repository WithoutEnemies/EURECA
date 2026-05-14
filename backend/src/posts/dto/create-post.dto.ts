import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const POST_IMAGE_URL_PATTERN =
  /^https?:\/\/[^?#\s]+\/uploads\/posts\/[^/?#\s]+\.(?:jpg|jpeg|png|webp)$/i;

// Define o formato valido para criar um post.
// O texto precisa existir e nao pode passar de 280 caracteres.
// A imagem chega como URL gerada pelo endpoint de upload local.
export class CreatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(280)
  content: string;

  @IsOptional()
  @IsString()
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_tld: false,
    },
    { message: 'A imagem precisa ser uma URL HTTP ou HTTPS válida.' },
  )
  @Matches(POST_IMAGE_URL_PATTERN, {
    message: 'Use uma imagem enviada pelo EURECA em JPG, PNG ou WebP.',
  })
  @MaxLength(2048)
  imageUrl?: string;
}
