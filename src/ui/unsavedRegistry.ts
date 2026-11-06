// Covers global actions (e.g. demo role changes) that would unmount a form before router blocking.
const forms = new Set<{ check: () => boolean; discard: () => void }>();
export function registerUnsavedForm(check: () => boolean, discard: () => void) {
  const form = { check, discard };
  forms.add(form);
  return () => {
    forms.delete(form);
  };
}
export function hasUnsavedForm() {
  return Array.from(forms).some((f) => f.check());
}
export function discardUnsavedForms() {
  for (const form of forms) if (form.check()) form.discard();
}
