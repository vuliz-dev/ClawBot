export function getDatetime(timezone?: string): string {
  const now = new Date();
  const tz = timezone ?? "Asia/Ho_Chi_Minh";
  try {
    return now.toLocaleString("vi-VN", {
      timeZone: tz,
      dateStyle: "full",
      timeStyle: "long",
    });
  } catch {
    return now.toISOString();
  }
}
