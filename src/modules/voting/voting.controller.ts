import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CreateNominationDto } from './dto/create-nomination.dto';
import { UpdateNominationDto } from './dto/update-nomination.dto';
import { ResponseHelper } from '../../common/utils/ResponseHelper';
import { getDependencies } from '../../common/utils/Dependencies';
import { AuthHelper } from '../../common/utils/AuthHelper';

export class VotingController {
  private dependencies: any;

  constructor(dependencies: any) {
    this.dependencies = dependencies;
  }

  async createNomination(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'POST') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }
      const user = authResult.user;

      const body = (await request.json()) as CreateNominationDto;
      const nominationData = {
        ...body,
        nominatorUserName: user.username,
        nominatorUserId: user.userId,
      };

      if (
        !nominationData.nominatedEmployeeId ||
        !nominationData.reason ||
        !nominationData.criteria
      ) {
        return ResponseHelper.badRequest(
          'Missing required fields: nominatedEmployeeId, reason, criteria'
        );
      }

      const nomination = await this.dependencies.votingService.createNomination(nominationData);
      context.log(`User ${user.email} created nomination:`, nomination.id);
      return ResponseHelper.created(nomination);
    } catch (error) {
      context.error('Error creating nomination:', error);
      if (error instanceof Error) {
        return ResponseHelper.badRequest(error.message);
      }
      return ResponseHelper.internalServerError();
    }
  }

  async updateNomination(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'PUT') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const id = request.params.id;
      if (!id) {
        return ResponseHelper.badRequest('Nomination ID is required');
      }

      const body = (await request.json()) as UpdateNominationDto;
      const nomination = await this.dependencies.votingService.updateNomination(id, body);
      return ResponseHelper.ok(nomination);
    } catch (error) {
      context.error('Error updating nomination:', error);
      if (error instanceof Error) {
        return ResponseHelper.badRequest(error.message);
      }
      return ResponseHelper.internalServerError();
    }
  }

  async deleteNomination(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'DELETE') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const id = request.params.id;
      if (!id) {
        return ResponseHelper.badRequest('Nomination ID is required');
      }

      await this.dependencies.votingService.deleteNomination(id);
      return ResponseHelper.ok({ message: 'Nomination deleted successfully' });
    } catch (error) {
      context.error('Error deleting nomination:', error);
      if (error instanceof Error) {
        return ResponseHelper.badRequest(error.message);
      }
      return ResponseHelper.internalServerError();
    }
  }

  async getNomination(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'GET') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const id = request.params.id;
      if (!id) {
        return ResponseHelper.badRequest('Nomination ID is required');
      }

      const nomination = await this.dependencies.votingService.getNomination(id);
      if (!nomination) {
        return ResponseHelper.notFound('Nomination not found');
      }

      return ResponseHelper.ok(nomination);
    } catch (error) {
      context.error('Error getting nomination:', error);
      return ResponseHelper.internalServerError();
    }
  }

  async getCurrentVoting(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'GET') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const voting = await this.dependencies.votingService.getCurrentVotingPeriod();
      return ResponseHelper.ok(voting);
    } catch (error) {
      context.error('Error getting current voting:', error);
      return ResponseHelper.internalServerError();
    }
  }

  async getAllVoting(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'GET') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const votings = await this.dependencies.votingService.getAllVotingPeriods();
      return ResponseHelper.ok(votings);
    } catch (error) {
      context.error('Error getting all voting periods:', error);
      return ResponseHelper.internalServerError();
    }
  }

  async getVotingResults(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'GET') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const votingPeriodId = request.params.votingPeriodId;
      if (!votingPeriodId) {
        return ResponseHelper.badRequest('Voting period ID is required');
      }

      const results = await this.dependencies.votingService.getVotingResults(votingPeriodId);
      return ResponseHelper.ok(results);
    } catch (error) {
      context.error('Error getting voting results:', error);
      return ResponseHelper.internalServerError();
    }
  }

  async closeVotingPeriod(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'POST') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const votingPeriodId = request.params.votingPeriodId;
      if (!votingPeriodId) {
        return ResponseHelper.badRequest('Voting period ID is required');
      }

      const result = await this.dependencies.votingService.closeVotingPeriod(votingPeriodId);
      return ResponseHelper.ok(result);
    } catch (error) {
      context.error('Error closing voting period:', error);
      if (error instanceof Error) {
        return ResponseHelper.badRequest(error.message);
      }
      return ResponseHelper.internalServerError();
    }
  }

  async getWinners(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'GET') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const winners = await this.dependencies.votingService.getWinners();
      return ResponseHelper.ok(winners);
    } catch (error) {
      context.error('Error getting winners:', error);
      return ResponseHelper.internalServerError();
    }
  }

  async getWinnersGrouped(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'GET') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }

      const winnersGrouped = await this.dependencies.votingService.getWinnersGrouped();
      return ResponseHelper.ok(winnersGrouped);
    } catch (error) {
      context.error('Error getting winners grouped:', error);
      return ResponseHelper.internalServerError();
    }
  }

  async getMyNominations(
    request: HttpRequest,
    context: InvocationContext
  ): Promise<HttpResponseInit> {
    try {
      if (request.method !== 'GET') {
        return ResponseHelper.methodNotAllowed();
      }

      const authResult = await AuthHelper.requireAuth(request, context);
      if (!authResult.success) {
        return authResult.response;
      }
      const user = authResult.user;

      const nomination = await this.dependencies.votingService.getMyNominations(user.username);

      if (!nomination) {
        return ResponseHelper.notFound(
          'No nomination found for the current user in the active voting period'
        );
      }

      return ResponseHelper.ok(nomination);
    } catch (error) {
      context.error('Error getting my nominations:', error);
      return ResponseHelper.internalServerError();
    }
  }
}

// Azure Functions endpoints
const createNominationFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);
  return controller.createNomination(request, context);
};

const nominationByIdFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);

  switch (request.method) {
    case 'GET':
      return controller.getNomination(request, context);
    case 'PUT':
      return controller.updateNomination(request, context);
    case 'DELETE':
      return controller.deleteNomination(request, context);
    default:
      return {
        status: 405,
        jsonBody: { message: 'Method not allowed' },
      };
  }
};

const getCurrentVotingFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);
  return controller.getCurrentVoting(request, context);
};

const getAllVotingFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);
  return controller.getAllVoting(request, context);
};

const getVotingResultsFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);
  return controller.getVotingResults(request, context);
};

const closeVotingPeriodFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);
  return controller.closeVotingPeriod(request, context);
};

const getWinnersFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);
  return controller.getWinners(request, context);
};

const getWinnersGroupedFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);
  return controller.getWinnersGrouped(request, context);
};

const getMyNominationsFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);
  return controller.getMyNominations(request, context);
};

// Register Azure Functions
app.http('create-nomination', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'nominations',
  handler: createNominationFunction,
});

app.http('nomination-by-id', {
  methods: ['GET', 'PUT', 'DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'nominations/{id}',
  handler: nominationByIdFunction,
});

app.http('get-current-voting', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'voting/current',
  handler: getCurrentVotingFunction,
});

app.http('get-all-voting', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'voting',
  handler: getAllVotingFunction,
});

app.http('get-voting-results', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'voting/{votingPeriodId}/results',
  handler: getVotingResultsFunction,
});

app.http('close-voting-period', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'voting/{votingPeriodId}/close',
  handler: closeVotingPeriodFunction,
});

app.http('get-winners', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'voting/winners',
  handler: getWinnersFunction,
});

app.http('get-winners-grouped', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'voting/winners/grouped',
  handler: getWinnersGroupedFunction,
});

app.http('get-my-nominations', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'nominations/my',
  handler: getMyNominationsFunction,
});
