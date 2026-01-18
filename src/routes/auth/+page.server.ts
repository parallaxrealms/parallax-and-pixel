import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { loginSchema, magicLinkSchema, otpVerifySchema } from '@parallaxrealms/schemas';
import type { Provider } from '@supabase/supabase-js';
import { Fail } from '@parallaxrealms/utils-core';

export const load: PageServerLoad = async (event) => {
  const parentData = await event.parent();
  const session = await event.locals.getSession();
  const successParam = event.url.searchParams.get('success');

  // Special case: don't redirect if this is a password reset success
  if (successParam === 'password_reset') {
    return {
      ...parentData,
      loginForm: await superValidate(zod(loginSchema)),
      magicLinkForm: await superValidate(zod(magicLinkSchema)),
      message: event.url.searchParams.get('message')
    };
  }

  /* User is already logged in. */
  if (session) throw redirect(303, '/dashboard');

  return {
    ...parentData,
    loginForm: await superValidate(zod(loginSchema)),
    magicLinkForm: await superValidate(zod(magicLinkSchema))
  };
};

export const actions: Actions = {
  signin_email: async ({ request, locals: { supabase } }) => {
const form = await superValidate(request, zod(loginSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    const email = form.data.email as string;
    const password = form.data.password as string;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Sign-in error:', error);
      return message(form, error.message, { status: (error.status || 400) as 400 });
    }

    if (!data.session) {
      return message(form, 'Login failed. Please try again.', { status: 400 });
    }

    /* Login successful, redirect. */
    throw redirect(303, '/dashboard');
  },

  magic: async ({ request, url, locals: { supabase } }) => {
const form = await superValidate(request, zod(magicLinkSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    const email = form.data.email as string;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${url.origin}/auth/callback?next=/dashboard`
      }
    });

    if (error) {
      return message(form, error.message, { status: (error.status || 400) as 400 });
    }

    return message(form, 'Please check your email for a magic link to log in.');
  },

  signin_otp: async ({ request, locals: { supabase } }) => {
    const formData = await request.formData();
    const phone = formData.get('phone') as string;

    if (!phone) {
      return Fail({ message: 'Please enter a phone number.' });
    }

    const { error } = await supabase.auth.signInWithOtp({
      phone
    });

    if (error) {
      return Fail({ message: error.message, phone });
    }

    return {
      message: 'Please check your phone for the OTP code and enter it below.',
      verify: true,
      phone
    };
  },

  verify_otp: async ({ request, locals: { supabase } }) => {
const form = await superValidate(request, zod(otpVerifySchema));

    if (!form.valid) {
      return fail(400, { form, verify: true });
    }

    const otp = form.data.otp as string;
    const phone = form.data.phone as string;

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        type: 'sms',
        token: otp,
        options: { redirectTo: `${new URL(request.url).origin}/dashboard` }
      });

      if (error) {
        return message(form, error.message, { status: (error.status || 400) as 400 });
      }

      if (data.session) {
        throw redirect(303, '/dashboard');
      }

      return message(form, 'Verification failed. Please try again.', { status: 400 });
    } catch (err) {
      // If it's already a redirect, rethrow it
      if (err instanceof Response && err.status === 303) {
        throw err;
      }

      console.error('OTP verification error:', err);
      return message(
        form,
        'An unexpected error occurred during verification.',
        { status: 500 }
      );
    }
  },

  oauth: async ({ request, url, locals: { supabase } }) => {
    const formData = await request.formData();
    const provider = formData.get('provider') as Provider;

    /**
     * Sign-in will not happen yet, because we're on the server-side,
     * but we need the returned url.
     */
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${url.origin}/auth/callback?next=/app`
      }
    });

    if (error) {
      return Fail(error);
    }

    /* Now authorize sign-in on browser. */
    if (data.url) throw redirect(303, data.url);
  },

  signout: async ({ locals: { supabase } }) => {
    await supabase.auth.signOut();
    throw redirect(303, '/');
  }
};