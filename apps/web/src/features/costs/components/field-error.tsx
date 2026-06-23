/** RHF alan hatası için tek satırlık mesaj (boşsa hiç render edilmez). */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}
