import { describe, it, expect } from "vitest";
import { connectionManager } from "../../../lib/sse-manager.js";

// Minimal FastifyReply mock with raw.write
function makeReply(fail: boolean = false): any {
  return {
    raw: {
      writes: [] as string[],
      write(chunk: string) {
        if (fail) throw new Error("write failed");
        this.writes.push(chunk);
      },
    },
  };
}

describe("ConnectionManager", () => {
  it("adds and removes clients, tracking count", () => {
    const r1 = makeReply();
    const r2 = makeReply();
    connectionManager.addClient(r1 as any);
    connectionManager.addClient(r2 as any);
    expect(connectionManager.getConnectionCount()).toBe(2);
    connectionManager.removeClient(r1 as any);
    expect(connectionManager.getConnectionCount()).toBe(1);
    connectionManager.removeClient(r2 as any);
    expect(connectionManager.getConnectionCount()).toBe(0);
  });

  it("broadcasts to all active clients with SSE formatting", () => {
    const r1 = makeReply();
    const r2 = makeReply();
    connectionManager.addClient(r1 as any);
    connectionManager.addClient(r2 as any);
    const sent = connectionManager.broadcastToAll("connection", {
      status: "ok",
    });
    expect(sent).toBe(2);
    expect(r1.raw.writes[0]).toMatch(/^event: connection\n/);
    expect(r1.raw.writes[0]).toMatch(/data: {"status":"ok"}\n\n$/);
    connectionManager.removeClient(r1 as any);
    connectionManager.removeClient(r2 as any);
  });

  it("removes dead connections on write failure", () => {
    const good = makeReply();
    const bad = makeReply(true);
    connectionManager.addClient(good as any);
    connectionManager.addClient(bad as any);
    const sent = connectionManager.broadcastToAll("observation", { test: 1 });
    // Only good connection should succeed
    expect(sent).toBe(1);
    expect(connectionManager.getConnectionCount()).toBe(1);
    connectionManager.removeClient(good as any);
  });
});
