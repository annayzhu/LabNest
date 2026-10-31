// The formal database `labnest` belongs to 3001, which keeps uploads in its container's volume. A development server
// (`next dev`) keeps uploads in its own folder, so on the formal database it leaves attachment rows whose files 3001
// cannot find, and the app's backup then refuses to verify.

/** Why this process must not open its database, or undefined: a development server on the formal database, unless allowed. */
export function formalDatabaseProblem(env: { DATABASE_URL?: string; NODE_ENV?: string; LABNEST_ALLOW_FORMAL_DATABASE?: string }) {
  if (env.NODE_ENV !== "development" || env.LABNEST_ALLOW_FORMAL_DATABASE === "1" || !env.DATABASE_URL) return undefined;
  let database: string;
  try {
    database = decodeURIComponent(new URL(env.DATABASE_URL).pathname.slice(1));
  } catch {
    return undefined;
  }
  if (database !== "labnest") return undefined;
  return "开发服务器连到了正式库 labnest：上传的文件只会存到这台电脑上，3001 找不到，备份也会因此失败。请把 DATABASE_URL 指向正式库的副本；确需如此时设置 LABNEST_ALLOW_FORMAL_DATABASE=1。 / The development server is connected to the formal database `labnest`: its uploads stay on this computer, where 3001 cannot find them. Point DATABASE_URL at a copy, or set LABNEST_ALLOW_FORMAL_DATABASE=1 if you mean it.";
}
