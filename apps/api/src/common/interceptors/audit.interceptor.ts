import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user } = request;

    // Only audit mutating operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          // Extract entity info from the URL (e.g., /api/users/123 → entityType: "users", entityId: "123")
          const urlParts = url
            .replace(/^\/api\//, '')
            .split('/')
            .filter(Boolean);
          const entityType = urlParts[0] || 'unknown';
          const entityId = urlParts[1] || 'unknown';

          // Determine action from HTTP method
          let action: string;
          switch (method) {
            case 'POST':
              action = 'CREATE';
              break;
            case 'PUT':
            case 'PATCH':
              action = 'UPDATE';
              break;
            case 'DELETE':
              action = 'DELETE';
              break;
            default:
              action = method;
          }

          const resolvedEntityId = String(
            (responseData as any)?.id || entityId || 'unknown',
          );

          await this.prisma.auditLog.create({
            data: {
              userId: user?.id || null,
              action,
              entityType,
              entityId: resolvedEntityId,
              oldData: null,
              newData: body ? JSON.stringify(body) : null,
              ipAddress: request.ip || null,
              userAgent: request.headers?.['user-agent'] || null,
            },
          });
        } catch (error) {
          // Don't let audit logging failures break the request
          console.error('Audit log failed:', error);
        }
      }),
    );
  }
}
