import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  /**
   * Data-deletion callback required by Meta / GDPR.
   * Logs the request and returns 200 so the form submission succeeds.
   * Actual deletion is handled manually within 72 h via the logged email.
   */
  @Post('deletion-request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request account & data deletion (GDPR / Meta policy)' })
  deletionRequest(@Body('email') email: string) {
    this.logger.log(`[DeletionRequest] email=${email ?? '(none)'} at ${new Date().toISOString()}`);
    return {
      ok: true,
      message: 'Solicitud recibida. Procesaremos la eliminación en un plazo máximo de 72 horas.',
    };
  }
}
