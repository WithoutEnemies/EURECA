import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  PayloadTooLargeException,
} from '@nestjs/common';

type ErrorResponse = {
  statusCode: number;
  message: string | string[];
  error?: string;
};

@Catch(BadRequestException, PayloadTooLargeException)
export class UploadsExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{
      status: (statusCode: number) => {
        json: (body: ErrorResponse) => void;
      };
    }>();
    const statusCode = exception.getStatus();
    const payload = exception.getResponse();
    const message =
      exception instanceof PayloadTooLargeException
        ? 'A imagem precisa ter até 5 MB.'
        : this.getMessage(payload);

    response.status(statusCode).json({
      statusCode,
      message,
      error:
        exception instanceof PayloadTooLargeException
          ? 'Payload Too Large'
          : 'Bad Request',
    });
  }

  private getMessage(payload: string | object) {
    if (typeof payload === 'string') {
      return payload;
    }

    if ('message' in payload) {
      const message = payload.message;
      if (typeof message === 'string' || Array.isArray(message)) {
        return message;
      }
    }

    return 'Não foi possível processar a imagem.';
  }
}
