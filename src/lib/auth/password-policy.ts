/** Regra mínima da senha do portal (a política do projeto Supabase pode exigir mais). */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (password.length > 72) return "A senha pode ter no máximo 72 caracteres.";
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) return "Use letras e números na senha.";
  return null;
}
