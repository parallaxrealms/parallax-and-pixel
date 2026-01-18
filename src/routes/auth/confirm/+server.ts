import type { EmailOtpType } from '@supabase/supabase-js'
import { redirect } from '@sveltejs/kit'

export const GET = async ({ url, locals: { supabase } }) => {
  const token_hash = url.searchParams.get('token_hash') as string
  const type = url.searchParams.get('type') as EmailOtpType
  let next = url.searchParams.get('next') ?? '/'

  // Remove leading slash if present to avoid double slash issue
  next = next.startsWith('/') ? next.substring(1) : next
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      redirect(303, `/${next}`)
    }
  }

  /* Return the user to an error page with some instructions */
  redirect(303, '/auth/error')
}
