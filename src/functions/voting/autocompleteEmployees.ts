import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ResponseHelper } from "../../containers/utils/ResponseHelper";
import { getDependencies } from "../../containers/utils/Dependencies";
import { AuthHelper } from "../../containers/utils/AuthHelper";

export async function autocompleteEmployees(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    if (request.method !== "GET") {
      return ResponseHelper.methodNotAllowed();
    }

    // Require authentication - any authenticated user can search employees
    const authResult = await AuthHelper.requireAuth(request, context);
    if (!authResult.success) {
      return authResult.response;
    }
    const user = authResult.user;

    // Get query parameter
    const query = request.query.get("q");
    if (!query || query.trim().length === 0) {
      return ResponseHelper.badRequest("Query parameter 'q' is required");
    }

    if (query.trim().length < 2) {
      return ResponseHelper.badRequest(
        "Query must be at least 2 characters long"
      );
    }

    const limit = parseInt(request.query.get("limit") || "10");
    if (limit < 1 || limit > 50) {
      return ResponseHelper.badRequest("Limit must be between 1 and 50");
    }

    const { azureEmployeeService } = await getDependencies();

    const results = await azureEmployeeService.searchEmployees(
      query.trim(),
      limit
    );

    context.log(
      `User ${user.email} searched for "${query}" and got ${results.length} results`
    );
    return ResponseHelper.ok(results);
  } catch (error) {
    context.error("Error searching employees:", error);
    return ResponseHelper.internalServerError();
  }
}

app.http("autocomplete-employees", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "employees/search",
  handler: autocompleteEmployees,
});
