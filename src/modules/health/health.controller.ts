import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { Public } from '../auth/decorators/auth.decorators';

export class HealthController {
  @Public()
  async getHealth(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log('Health check endpoint called');
    return {
      status: 200,
      jsonBody: { status: 'ok' },
    };
  }
}

// Azure Function endpoint
const healthFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const controller = new HealthController();
  return controller.getHealth(request, context);
};

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: healthFunction,
});
