export const load = async ({ locals: { getSession } }: { locals: { getSession: () => Promise<any> } }) => {
  const session = await getSession();

  return {
    session
  };
};