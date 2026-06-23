/** Settings (üyelik) feature'ı için query key fabrikası. */
export const memberKeys = {
  members: () => ["members"] as const,
  invitations: () => ["invitations"] as const,
};
