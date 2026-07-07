// ---------------------------------------------------------------------------
// Command Bus — decouples "something happened" (a dispatch call) from
// "something handles it" (a registered handler), so a feature module never
// needs to import another feature module directly to trigger its behavior.
//
// This buys real decoupling at a real cost (an extra indirection layer, a
// harder-to-follow call path than a plain function call) — worth it once
// you have several independent feature modules that need to talk to each
// other without depending on each other's internals, which is the
// architecture this app is deliberately moving toward.
//
// Type safety is not sacrificed for the pattern: every command type is a key
// in `CommandMap` below, and `dispatch`/`register` are generic over that key,
// so a mistyped command name or a wrong payload shape is still a compile
// error — the whole point of doing this "the bus way" instead of a bag of
// `any`.
// ---------------------------------------------------------------------------

import type { RegistrationStage, ActiveScreen, DialCountry } from "../types";

/** Every command the app can dispatch, and the exact payload each one
 * carries. Adding a new command means adding one line here — every
 * dispatch/register call site for it is then fully typed against this. */
export interface CommandMap {
  "auth/login": { method: "secureId" | "mobile" };
  "auth/logout": void;
  "auth/register": void;
  "navigation/openScreen": { screen: ActiveScreen };
  "navigation/setStage": { stage: RegistrationStage };
  "banking/linkAccount": { bankId: string };
  "send/submit": { amountFrom: string; countryFrom: DialCountry; countryTo: DialCountry };
  "receive/tokenRotated": { token: string };
  "notification/show": { message: string; tone?: "info" | "success" | "error" };
}

export type CommandType = keyof CommandMap;
type Handler<K extends CommandType> = (payload: CommandMap[K]) => void;
export type Middleware = <K extends CommandType>(type: K, payload: CommandMap[K], next: () => void) => void;

class CommandBus {
  private handlers = new Map<CommandType, Set<Handler<any>>>();
  private middleware: Middleware[] = [];

  /** Registers a handler for a command type. Returns an unsubscribe
   * function — call it (typically from a useEffect cleanup) so a feature
   * module's handler doesn't keep firing after that module unmounts. */
  register<K extends CommandType>(type: K, handler: Handler<K>): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  /** Adds a cross-cutting middleware (logging, analytics, etc.) that runs
   * before every dispatch, for every command type. */
  use(mw: Middleware): void {
    this.middleware.push(mw);
  }

  dispatch<K extends CommandType>(type: K, payload: CommandMap[K]): void {
    const run = (index: number) => {
      if (index < this.middleware.length) {
        this.middleware[index](type, payload, () => run(index + 1));
        return;
      }
      const set = this.handlers.get(type);
      if (!set || set.size === 0) {
        if (import.meta.env?.DEV) {
          // eslint-disable-next-line no-console
          console.warn(`[commandBus] "${type}" dispatched with no registered handler.`);
        }
        return;
      }
      set.forEach((h) => h(payload));
    };
    run(0);
  }
}

export const commandBus = new CommandBus();

// Dev-only logging middleware — silent in production builds.
if (import.meta.env?.DEV) {
  commandBus.use((type, payload, next) => {
    // eslint-disable-next-line no-console
    console.debug(`[commandBus] ${type}`, payload);
    next();
  });
}
