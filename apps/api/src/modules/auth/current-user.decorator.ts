import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/** Extracts the authenticated user's id from the JWT set on the request by AuthGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<{ user?: { sub: string } }>();
  if (!req.user?.sub) {
    throw new UnauthorizedException('Authentication required');
  }
  return req.user.sub;
});
