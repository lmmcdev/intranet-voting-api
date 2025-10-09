import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CreateNominationDto } from './dto/create-nomination.dto';
import { UpdateNominationDto } from './dto/update-nomination.dto';
import { UpdateVotingPeriodDto } from './dto/update-voting-period.dto';
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

  async getVotingPeriodById(
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

      const period = await this.dependencies.votingService.getVotingPeriodById(votingPeriodId);

      if (!period) {
        return ResponseHelper.notFound('Voting period not found');
      }

      return ResponseHelper.ok(period);
    } catch (error) {
      context.error('Error getting voting period by ID:', error);
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

  async updateVotingPeriod(
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

      const votingPeriodId = request.params.votingPeriodId;
      if (!votingPeriodId) {
        return ResponseHelper.badRequest('Voting period ID is required');
      }

      const body = (await request.json()) as UpdateVotingPeriodDto;
      const updatedPeriod = await this.dependencies.votingService.updateVotingPeriod(
        votingPeriodId,
        body
      );
      return ResponseHelper.ok(updatedPeriod);
    } catch (error) {
      context.error('Error updating voting period:', error);
      if (error instanceof Error) {
        return ResponseHelper.badRequest(error.message);
      }
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

  async resetVotingPeriod(
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

      // Only admins can reset voting periods
      const user = authResult.user;
      if (!user.roles?.includes('admin')) {
        return ResponseHelper.forbidden('Admin access required');
      }

      const votingPeriodId = request.params.votingPeriodId;
      if (!votingPeriodId) {
        return ResponseHelper.badRequest('Voting period ID is required');
      }

      const result = await this.dependencies.votingService.resetVotingPeriod(votingPeriodId);

      if (result.success) {
        context.log(
          `Admin ${user.email} reset voting period ${votingPeriodId}: ${result.nominationsDeleted} nominations and ${result.winnersDeleted} winners deleted`
        );
        return ResponseHelper.ok(result);
      } else {
        return ResponseHelper.badRequest(result.message);
      }
    } catch (error) {
      context.error('Error resetting voting period:', error);
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

  async getCurrentWinner(
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

      const winner = await this.dependencies.votingService.getCurrentWinner();

      if (!winner) {
        return ResponseHelper.notFound('No current winner found. No closed voting periods available.');
      }

      return ResponseHelper.ok(winner);
    } catch (error) {
      context.error('Error getting current winner:', error);
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

  async selectRandomWinner(
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

      const winner =
        await this.dependencies.votingService.selectRandomWinnerFromAll(votingPeriodId);
      return ResponseHelper.ok(winner);
    } catch (error) {
      context.error('Error selecting random winner:', error);
      if (error instanceof Error) {
        return ResponseHelper.badRequest(error.message);
      }
      return ResponseHelper.internalServerError();
    }
  }

  async getWinnerHistory(
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

      const year = request.query.get('year');
      const month = request.query.get('month');
      const winnerType = request.query.get('winnerType');

      let history;
      if (year && month) {
        history = await this.dependencies.votingService.getWinnerHistoryByYearAndMonth(
          parseInt(year),
          parseInt(month),
          winnerType || undefined
        );
      } else if (year) {
        history = await this.dependencies.votingService.getWinnerHistoryByYear(
          parseInt(year),
          winnerType || undefined
        );
      } else {
        history = await this.dependencies.votingService.getWinnerHistory();
      }

      return ResponseHelper.ok(history);
    } catch (error) {
      context.error('Error getting winner history:', error);
      return ResponseHelper.internalServerError();
    }
  }

  async getYearlyWinners(
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

      const year = request.query.get('year');

      let yearlyWinners;
      if (year) {
        const winner = await this.dependencies.votingService.getYearlyWinnerByYear(parseInt(year));
        yearlyWinners = winner ? [winner] : [];
      } else {
        yearlyWinners = await this.dependencies.votingService.getYearlyWinners();
      }

      return ResponseHelper.ok(yearlyWinners);
    } catch (error) {
      context.error('Error getting yearly winners:', error);
      return ResponseHelper.internalServerError();
    }
  }

  async markYearlyWinner(
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

      const winnerId = request.params.winnerId;
      if (!winnerId) {
        return ResponseHelper.badRequest('Winner ID is required');
      }

      const yearlyWinner = await this.dependencies.votingService.markWinnerAsYearly(winnerId);
      return ResponseHelper.ok(yearlyWinner);
    } catch (error) {
      context.error('Error marking yearly winner:', error);
      if (error instanceof Error) {
        return ResponseHelper.badRequest(error.message);
      }
      return ResponseHelper.internalServerError();
    }
  }

  async unmarkYearlyWinner(
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

      const winnerId = request.params.winnerId;
      if (!winnerId) {
        return ResponseHelper.badRequest('Winner ID is required');
      }

      const winner = await this.dependencies.votingService.unmarkWinnerAsYearly(winnerId);
      return ResponseHelper.ok(winner);
    } catch (error) {
      context.error('Error unmarking yearly winner:', error);
      if (error instanceof Error) {
        return ResponseHelper.badRequest(error.message);
      }
      return ResponseHelper.internalServerError();
    }
  }

  async getEmployeeResults(
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

      const employeeId = request.params.employeeId;
      if (!employeeId) {
        return ResponseHelper.badRequest('Employee ID is required');
      }

      const votingPeriodId = request.query.get('votingPeriodId');

      const results = await this.dependencies.votingService.getEmployeeResults(
        employeeId,
        votingPeriodId || undefined
      );
      return ResponseHelper.ok(results);
    } catch (error) {
      context.error('Error getting employee results:', error);
      return ResponseHelper.internalServerError();
    }
  }

  async createBulkNominationsForTesting(
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

      // Only admins can use this endpoint
      const user = authResult.user;
      if (!user.roles?.includes('admin')) {
        return ResponseHelper.forbidden('Admin access required');
      }

      const body = (await request.json()) as { count?: number };
      const count = body.count || 10;

      if (count < 1 || count > 1000) {
        return ResponseHelper.badRequest('Count must be between 1 and 1000');
      }

      const result = await this.dependencies.votingService.createBulkNominationsForTesting(count);

      context.log(
        `Admin ${user.email} created ${result.created} bulk nominations for testing (${result.failed} failed)`
      );

      return ResponseHelper.ok(result);
    } catch (error) {
      context.error('Error creating bulk nominations:', error);
      if (error instanceof Error) {
        return ResponseHelper.badRequest(error.message);
      }
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

const votingPeriodByIdFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);

  switch (request.method) {
    case 'GET':
      return controller.getVotingPeriodById(request, context);
    case 'PUT':
      return controller.updateVotingPeriod(request, context);
    default:
      return ResponseHelper.methodNotAllowed();
  }
};

const closeVotingPeriodFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);
  return controller.closeVotingPeriod(request, context);
};

const resetVotingPeriodFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);
  return controller.resetVotingPeriod(request, context);
};

const getWinnersFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);
  return controller.getWinners(request, context);
};

const getCurrentWinnerFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);
  return controller.getCurrentWinner(request, context);
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

const selectRandomWinnerFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);
  return controller.selectRandomWinner(request, context);
};

const getWinnerHistoryFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);
  return controller.getWinnerHistory(request, context);
};

const getYearlyWinnersFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);
  return controller.getYearlyWinners(request, context);
};

const markYearlyWinnerFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);
  return controller.markYearlyWinner(request, context);
};

const unmarkYearlyWinnerFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);
  return controller.unmarkYearlyWinner(request, context);
};

const getEmployeeResultsFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);
  return controller.getEmployeeResults(request, context);
};

const createBulkNominationsForTestingFunction = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const dependencies = await getDependencies();
  const controller = new VotingController(dependencies);
  return controller.createBulkNominationsForTesting(request, context);
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
  route: 'voting/current-period',
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

app.http('voting-period-by-id', {
  methods: ['GET', 'PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'voting/{votingPeriodId}',
  handler: votingPeriodByIdFunction,
});

app.http('close-voting-period', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'voting/{votingPeriodId}/close',
  handler: closeVotingPeriodFunction,
});

app.http('reset-voting-period-data', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'voting/{votingPeriodId}/reset',
  handler: resetVotingPeriodFunction,
});

app.http('get-winners', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'voting/winners',
  handler: getWinnersFunction,
});

app.http('get-current-winner', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'voting/winners/current',
  handler: getCurrentWinnerFunction,
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

app.http('select-random-winner', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'voting/{votingPeriodId}/select-winner',
  handler: selectRandomWinnerFunction,
});

app.http('get-winner-history', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'voting/winners/history',
  handler: getWinnerHistoryFunction,
});

app.http('get-yearly-winners', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'voting/winners/yearly',
  handler: getYearlyWinnersFunction,
});

app.http('mark-yearly-winner', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'voting/winners/{winnerId}/yearly',
  handler: markYearlyWinnerFunction,
});

app.http('unmark-yearly-winner', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'voting/winners/{winnerId}/yearly',
  handler: unmarkYearlyWinnerFunction,
});

app.http('get-employee-results', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'voting/employees/{employeeId}/results',
  handler: getEmployeeResultsFunction,
});

app.http('create-bulk-nominations-testing', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'voting/testing/bulk-nominations',
  handler: createBulkNominationsForTestingFunction,
});
