import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Extracts the authenticated user's id from the JWT set on the request by AuthGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<{ user?: { sub: string } }>();
  return req.user?.sub ?? 'demo-user';
});
