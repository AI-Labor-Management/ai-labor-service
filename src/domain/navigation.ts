export function choiceParam<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}
export function validMonth(value: string | null): value is string {
  return !!value && /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(value);
}
