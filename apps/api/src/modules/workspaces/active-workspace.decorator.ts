import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Extracts the workspace id validated by WorkspaceGuard and attached to the request. */
export const ActiveWorkspace = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<{ workspaceId?: string }>();
  return req.workspaceId as string;
});
