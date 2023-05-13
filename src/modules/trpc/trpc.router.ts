import { createTRPCRouter } from './trpc.server';

import { openAIRouter } from '~/modules/llms/openai/openai.router';

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  openai: openAIRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
