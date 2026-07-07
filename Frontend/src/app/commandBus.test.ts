import { describe, it, expect, vi } from "vitest";
import { commandBus } from "./commandBus";

describe("commandBus", () => {
  it("delivers a dispatched command to its registered handler", () => {
    const handler = vi.fn();
    const unregister = commandBus.register("navigation/openScreen", handler);

    commandBus.dispatch("navigation/openScreen", { screen: "send" });

    expect(handler).toHaveBeenCalledWith({ screen: "send" });
    unregister();
  });

  it("stops delivering to a handler after it unregisters", () => {
    const handler = vi.fn();
    const unregister = commandBus.register("navigation/openScreen", handler);
    unregister();

    commandBus.dispatch("navigation/openScreen", { screen: "bank" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("delivers to every handler registered for the same command type", () => {
    const first = vi.fn();
    const second = vi.fn();
    const unregisterFirst = commandBus.register("auth/logout", first);
    const unregisterSecond = commandBus.register("auth/logout", second);

    commandBus.dispatch("auth/logout", undefined);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    unregisterFirst();
    unregisterSecond();
  });

  it("does not throw when dispatching a command with no registered handler", () => {
    expect(() => commandBus.dispatch("banking/linkAccount", { bankId: "no-handler-for-this" })).not.toThrow();
  });
});
