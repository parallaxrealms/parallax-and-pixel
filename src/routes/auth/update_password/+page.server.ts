import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate, message } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { updatePasswordSchema } from '@parallaxrealms/schemas';

export const load: PageServerLoad = async () => {
const form = await superValidate(zod(updatePasswordSchema));
  return { form };
};

export const actions: Actions = {
  default: async ({ request, locals: { supabase } }) => {
    const form = await superValidate(request, zod(updatePasswordSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    const password = form.data.password as string;

    const { error } = await supabase.auth.updateUser({
      password
    });

    if (error) {
      return message(form, error.message, { status: (error.status || 400) as 400 });
    }

    // Redirect to login with success message
    throw redirect(
      303,
      '/auth?success=password_reset&message=Your password has been successfully updated. Please sign in with your new password.'
    );
  }
};