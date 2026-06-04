import { z } from 'zod'

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
})

const serverSchema = z.object({
  ZOHO_CLIENT_ID: z.string().min(1),
  ZOHO_CLIENT_SECRET: z.string().min(1),
  ZOHO_REFRESH_TOKEN: z.string().min(1),
  ZOHO_ACCOUNTS_URL: z.string().url(),
  ZOHO_API_BASE: z.string().url(),
  ZOHO_ACCOUNT_OWNER: z.string().min(1),
  ZOHO_APP_NAME: z.string().min(1),
  ZOHO_TEST_REPORT: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  HEALTH_CHECK_SECRET: z.string().min(1),
})

type PublicEnv = z.infer<typeof publicSchema>
type ServerEnv = z.infer<typeof serverSchema>

const isServer = typeof window === 'undefined'

function parseOrThrow<T extends z.ZodType>(schema: T, input: Record<string, unknown>, label: string): z.infer<T> {
  const result = schema.safeParse(input)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid ${label} environment variables:\n${issues}`)
  }
  return result.data
}

const publicEnv: PublicEnv = parseOrThrow(
  publicSchema,
  {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  'public',
)

const serverEnv: ServerEnv = isServer
  ? parseOrThrow(
      serverSchema,
      {
        ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID,
        ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET,
        ZOHO_REFRESH_TOKEN: process.env.ZOHO_REFRESH_TOKEN,
        ZOHO_ACCOUNTS_URL: process.env.ZOHO_ACCOUNTS_URL,
        ZOHO_API_BASE: process.env.ZOHO_API_BASE,
        ZOHO_ACCOUNT_OWNER: process.env.ZOHO_ACCOUNT_OWNER,
        ZOHO_APP_NAME: process.env.ZOHO_APP_NAME,
        ZOHO_TEST_REPORT: process.env.ZOHO_TEST_REPORT,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        CRON_SECRET: process.env.CRON_SECRET,
        HEALTH_CHECK_SECRET: process.env.HEALTH_CHECK_SECRET,
      },
      'server',
    )
  : (new Proxy({} as ServerEnv, {
      get(_target, prop) {
        throw new Error(
          `Server-only env var "${String(prop)}" is not accessible in browser context. ` +
            `Move this code to a Server Component, Route Handler, or Server Action.`,
        )
      },
    }) as ServerEnv)

export const env: PublicEnv & ServerEnv = isServer
  ? { ...publicEnv, ...serverEnv }
  : (new Proxy({ ...publicEnv } as PublicEnv & ServerEnv, {
      get(target, prop: string) {
        if (prop in target) return target[prop as keyof typeof target]
        throw new Error(
          `Server-only env var "${prop}" is not accessible in browser context. ` +
            `Only NEXT_PUBLIC_* vars can be read on the client.`,
        )
      },
    }))
