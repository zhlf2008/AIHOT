declare module "cloudflare:node" {
  export function handleAsNodeRequest(port: number, request: Request): Promise<Response>;
}
// The Workflow subset used here, matching @cloudflare/workers-types 5.20261016.1.
// Keep platform declarations scoped so they do not replace Node's URL/Buffer types in the engine.
declare module "cloudflare:workers" {
  export interface WorkflowEvent<T> { payload: Readonly<T>; timestamp: Date; instanceId: string; schedule?: unknown }
  export interface WorkflowStep {
    do<T>(name: string, config: { retries?: { limit: number; delay: string; backoff?: "linear" | "exponential" | "constant" }; timeout?: string }, callback: () => Promise<T>): Promise<T>;
  }
  export abstract class WorkflowEntrypoint<Env, Params> {
    protected env: Env;
    constructor(ctx: unknown, env: Env);
    abstract run(event: WorkflowEvent<Params>, step: WorkflowStep): Promise<unknown>;
  }
}
