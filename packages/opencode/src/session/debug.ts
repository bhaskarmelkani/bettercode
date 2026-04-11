import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { InstanceState } from "@/effect/instance-state"
import { makeRuntime } from "@/effect/run-service"
import { Effect, Layer, Context } from "effect"
import { SessionID } from "./schema"
import z from "zod"
import { ulid } from "ulid"

export namespace SessionDebug {
  export const Toggle = z
    .object({
      sessionID: SessionID.zod,
      enabled: z.boolean(),
    })
    .meta({
      ref: "SessionDebugToggle",
    })

  export const Entry = z
    .object({
      id: z.string(),
      sessionID: SessionID.zod,
      time: z.number(),
      stage: z.string(),
      title: z.string(),
      data: z.record(z.string(), z.any()),
    })
    .meta({
      ref: "SessionDebugEntry",
    })

  export const Event = {
    Updated: BusEvent.define("session.debug.updated", Toggle),
    Trace: BusEvent.define("session.debug.trace", Entry),
  }

  export interface Interface {
    readonly enabled: (sessionID: SessionID) => Effect.Effect<boolean>
    readonly set: (sessionID: SessionID, enabled: boolean) => Effect.Effect<void>
    readonly trace: (input: {
      sessionID: SessionID
      stage: string
      title: string
      data?: Record<string, any>
      force?: boolean
    }) => Effect.Effect<void>
  }

  export class Service extends Context.Service<Service, Interface>()("@opencode/SessionDebug") {}

  export const layer = Layer.effect(
    Service,
    Effect.gen(function* () {
      const bus = yield* Bus.Service
      const state = yield* InstanceState.make(
        Effect.fn("SessionDebug.state")(function* () {
          return {
            enabled: new Set<SessionID>(),
          }
        }),
      )

      const enabled = Effect.fn("SessionDebug.enabled")(function* (sessionID: SessionID) {
        const s = yield* InstanceState.get(state)
        return s.enabled.has(sessionID)
      })

      const set = Effect.fn("SessionDebug.set")(function* (sessionID: SessionID, next: boolean) {
        const s = yield* InstanceState.get(state)
        if (next) s.enabled.add(sessionID)
        else s.enabled.delete(sessionID)
        yield* bus.publish(Event.Updated, { sessionID, enabled: next })
      })

      const trace = Effect.fn("SessionDebug.trace")(function* (input: {
        sessionID: SessionID
        stage: string
        title: string
        data?: Record<string, any>
        force?: boolean
      }) {
        if (!input.force && !(yield* enabled(input.sessionID))) return
        yield* bus.publish(Event.Trace, {
          id: ulid(),
          sessionID: input.sessionID,
          time: Date.now(),
          stage: input.stage,
          title: input.title,
          data: input.data ?? {},
        })
      })

      return Service.of({ enabled, set, trace })
    }),
  )

  export const defaultLayer = layer.pipe(Layer.provide(Bus.defaultLayer))
  const { runPromise } = makeRuntime(Service, defaultLayer)

  export async function enabled(sessionID: SessionID) {
    return runPromise((svc) => svc.enabled(sessionID))
  }

  export async function set(sessionID: SessionID, enabled: boolean) {
    return runPromise((svc) => svc.set(sessionID, enabled))
  }

  export async function trace(input: {
    sessionID: SessionID
    stage: string
    title: string
    data?: Record<string, any>
    force?: boolean
  }) {
    return runPromise((svc) => svc.trace(input))
  }
}
