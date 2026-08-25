const revisionSuffix = /\s+—\s+(?:versão|histórico)\s+\d{4}-\d{2}-\d{2}(?:\s+[\w-]+)?$/i;

/** Keeps internally preserved revisions out of RH's main catalogue. */
export function logicalScheduleName(name: string) {
  return name.replace(revisionSuffix, "").trim();
}

export function selectCurrentLogicalTemplates<T extends { name: string; createdAt: Date }>(templates: readonly T[]) {
  const current = new Map<string, T>();
  for (const template of templates) {
    const key = logicalScheduleName(template.name).toLocaleLowerCase("pt-BR");
    const selected = current.get(key);
    if (!selected || selected.createdAt < template.createdAt) current.set(key, template);
  }
  return [...current.values()];
}
