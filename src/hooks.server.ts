import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public'
import { createServerClient } from '@supabase/ssr'
import { redirect, type Handle } from '@sveltejs/kit'
import { JWT_SECRET } from '$env/static/private'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { Session } from '@supabase/supabase-js'
import type { SupabaseJwt } from '@parallaxrealms/types-auth'

// Create JWKS for asymmetric JWT verification
const SUPABASE_JWT_ISSUER = `${PUBLIC_SUPABASE_URL}/auth/v1`
const SUPABASE_JWT_KEYS = createRemoteJWKSet(
  new URL(`${SUPABASE_JWT_ISSUER}/.well-known/jwks.json`)
)

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.supabase = createServerClient(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => event.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            event.cookies.set(name, value, { ...options, path: '/' })
          })
        }
      }
    }
  )

  event.locals.getSession = async (): Promise<Session | null> => {
    const {
      data: { session },
    } = await event.locals.supabase.auth.getSession()

    if (!session) return null

    /**
     * Validates the session using asymmetric JWT verification when possible,
     * falling back to symmetric verification for backward compatibility.
     */
    try {
      let decoded: SupabaseJwt

      try {
        // Try asymmetric verification first (new method)
        const { payload } = await jwtVerify(session.access_token, SUPABASE_JWT_KEYS, {
          issuer: SUPABASE_JWT_ISSUER
        })
        decoded = payload as SupabaseJwt
      } catch (asymmetricError: unknown) {
        // Fallback to symmetric verification (legacy method)
        const errorMessage = asymmetricError instanceof Error ? asymmetricError.message : 'Unknown error'
        console.log('Asymmetric verification failed, trying symmetric...', errorMessage)
        const { payload } = await jwtVerify(
          session.access_token,
          new TextEncoder().encode(JWT_SECRET)
        )
        decoded = payload as SupabaseJwt
      }

      /**
       * Create a validated session from the JWT claims.
       * This avoids network calls while ensuring the session is valid.
       */
      const validated_session: Session = {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: decoded.exp,
        expires_in: decoded.exp - Math.round(Date.now() / 1000),
        token_type: 'bearer',
        user: {
          app_metadata: decoded.app_metadata ?? {},
          aud: 'authenticated',
          created_at: '',
          id: decoded.sub,
          email: decoded.email,
          phone: decoded.phone,
          user_metadata: {
            username: decoded.user_metadata?.username
          },
          is_anonymous: decoded.is_anonymous ?? false
        }
      }

      return validated_session
    } catch (err) {
      console.error('JWT verification failed:', err)
      return null
    }
  }

  const session = await event.locals.getSession()

  /**
   * Only authenticated users can access these paths and their sub-paths.
   */
  const auth_protected_paths = new Set(['(admin)'])
  if (!session && auth_protected_paths.has(event.route.id?.split('/')[1] || ''))
    redirect(307, '/auth')

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version'
    },
  })
}