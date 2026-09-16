import { sweepExpiredReservations } from "./lib/reservation-lifecycle";

interface RecoveryEnvironment {
  DB: D1Database;
}

export default {
  async scheduled(_controller: ScheduledController, env: RecoveryEnvironment, context: ExecutionContext) {
    context.waitUntil(sweepExpiredReservations(env.DB, { limit: 100 }));
  },

  async fetch() {
    return new Response("This Worker only accepts Cloudflare scheduled events.", { status: 404 });
  },
} satisfies ExportedHandler<RecoveryEnvironment>;
