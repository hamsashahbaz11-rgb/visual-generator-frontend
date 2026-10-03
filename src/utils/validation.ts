import { z } from 'zod'

export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) })
export const registerSchema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(12) })
export const visualSpecSchema = z.object({
  version: z.literal(1),
  meta: z.object({ fps: z.number().int().min(10).max(60), width: z.number().int().min(320).max(3840), height: z.number().int().min(240).max(2160), durationInSeconds: z.number().positive().max(3600) }),
  theme: z.object({ background: z.object({ type: z.string() }).passthrough(), palette: z.record(z.string()), fontFamily: z.string(), speed: z.number(), defaultEasing: z.string() }),
  scenes: z.array(z.object({ id: z.string(), component: z.string(), at: z.number(), duration: z.number().positive(), position: z.object({ anchor: z.string(), offsetX: z.number(), offsetY: z.number() }), props: z.record(z.unknown()), enter: z.object({ style: z.string(), duration: z.number(), easing: z.string() }) })),
}).passthrough()
