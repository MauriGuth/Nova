import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string | string[];
    let error: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string | string[]) || exception.message;
        error = (resp.error as string) || exception.name;
      } else {
        message = exception.message;
        error = exception.name;
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'InternalServerError';

      const err = exception as { code?: string; message?: string };
      const errMsg = (err?.message ?? '').toLowerCase();
      const isPrismaSchemaError =
        err?.code === 'P2010' ||
        err?.code === 'P2021' ||
        errMsg.includes('column') && (errMsg.includes('does not exist') || errMsg.includes('no existe'));

      if (isPrismaSchemaError) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message =
          'Esquema de base de datos desactualizado. Ejecute en la API: npx prisma migrate deploy';
        error = 'SchemaOutdated';
      } else {
        console.error('Unhandled exception:', exception);
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
