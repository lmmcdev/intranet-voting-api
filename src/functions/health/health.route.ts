import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

const health = async (
  req: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  context.log("Health check endpoint called");
  return {
    status: 200,
    jsonBody: { status: "ok" },
  };
};

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: health,
});
