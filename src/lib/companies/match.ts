const normalize = (value: string) => value.trim().toLowerCase().replace(/[\s\-_]/g, "");

/** Vínculo legado por texto: aceita id exato, nome exato ou mesmo número da companhia. */
export function matchesCompany(target: string | null | undefined, comp: { id: string; name: string }): boolean {
  if (!target) return false;
  const t = normalize(target);
  if (t === normalize(comp.id) || t === normalize(comp.name)) return true;
  const targetNum = target.replace(/\D/g, "");
  const compNum = comp.id.replace(/\D/g, "");
  return !!targetNum && !!compNum && targetNum === compNum;
}
