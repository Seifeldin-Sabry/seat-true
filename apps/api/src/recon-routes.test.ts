import { expect, test } from "bun:test";
import { createReconRoutes } from "./recon-routes";
import type { ReconService } from "./reconciliation";

test("lapsed subscriptions are read-only: reads work, writes get 402", async () => {
  const recon = {
    overview: async () => ({ run: null }),
    loadDemo: async () => {
      throw new Error("must not run");
    },
  } as unknown as ReconService;
  const routes = createReconRoutes({
    recon,
    getUser: async () => ({ id: "user-1" }),
    allowedOrigins: ["http://localhost:3000"],
    canWrite: async () => false,
  });
  const read = await routes.handle(
    new Request("http://localhost/recon/overview"),
  );
  expect(read.status).toBe(200);
  const write = await routes.handle(
    new Request("http://localhost/recon/demo", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    }),
  );
  expect(write.status).toBe(402);
  expect((await write.json()).error.code).toBe("SUBSCRIPTION_INACTIVE");
});
