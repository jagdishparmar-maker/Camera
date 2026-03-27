# PocketBase email/password authentication — Web (Next.js) then Android (Kotlin)

This document describes how to add **email + password** authentication using PocketBase’s built-in **Users** auth, in a sensible order: **desktop web first** (`webapp_nextjs`), then **mobile** (`kotlin_gatems`). Implement when ready; treat this as the checklist and architecture reference.

---

## 1. Why implement web first

- **Rules and visibility**: You can lock down collections (`vehicles`, file URLs, realtime) in the PocketBase Admin UI and verify behaviour in the browser (Network tab, fewer moving parts than Android).
- **Single source of truth**: Same JWT and same `users` collection for both clients; web validates the flow before wiring Kotlin.
- **User control**: Admin can create/disable users, reset passwords, and audit logins from PocketBase without shipping app updates.

---

## 2. PocketBase server setup (Admin UI)

1. **Users collection**  
   PocketBase ships with a `users` collection (auth enabled). Confirm **Email/Password** auth is allowed under the collection’s **Auth** settings.

2. **Create test users**  
   Use Admin → Users → create user with email/password (or enable public registration only if you intentionally want self-signup).

3. **API rules** (example direction — adjust to your product)  
   - **`vehicles` (and related collections)**  
     Replace open `list/view/create/update` rules with rules that require a logged-in user, e.g.  
     `@request.auth.id != ""`  
     or stricter filters (e.g. only records linked to the user) if you add relation fields later.  
   - **File access**  
     If vehicle images use file fields, ensure file **View** rules align with record access so unauthenticated clients cannot guess URLs.

4. **HTTPS in production**  
   Serve PocketBase behind HTTPS; JWTs must not be sent over plain HTTP in production.

5. **Optional: hooks**  
   If you use `pocketbase_hooks` for automation, keep hooks idempotent and do not log raw passwords.

---

## 3. Next.js app (`webapp_nextjs`) — recommended approach

**Current state**: `src/lib/pocketbase.ts` exports a singleton `PocketBase` client with `NEXT_PUBLIC_POCKETBASE_URL`. There is no auth yet; realtime uses `pb.collection("vehicles").subscribe(...)`.

### 3.1 Client-side auth with the official JS SDK

PocketBase JS stores auth on the client (`pb.authStore`). After login, all requests and subscriptions automatically send the JWT.

- **Login**  
  `await pb.collection("users").authWithPassword(email, password)`  
  (or `authWithOAuth2` later if you add social login.)

- **Logout**  
  `pb.authStore.clear()`

- **Persistence**  
  The SDK can persist to `localStorage` (default) so refresh keeps the session. For stricter control you can use a custom `AsyncAuthStore` (see PocketBase JS docs).

- **Restore on load**  
  On app init, `pb.authStore` is restored from storage; subscribe to `pb.authStore.onChange` to drive React state (logged-in vs logged-out UI).

### 3.2 UI and routing

- Add routes such as `/login` (public) and protect the dashboard (e.g. `/` or `/app/...`) by redirecting unauthenticated users to `/login`.
- **App Router**: Prefer a small **client** auth provider (context or simple hook) that reads `pb.authStore.model` / `pb.authStore.token` and `onChange`, because `pocketbase` uses browser APIs.

### 3.3 Realtime after auth

Your `subscribeVehicles` already uses the shared `pb` instance. Once `authWithPassword` succeeds, the same `pb` connection will send `Authorization: Bearer <token>` for realtime if the subscription requires auth — **no separate token wiring** in `realtime.ts` beyond using the authenticated `pb`.

### 3.4 Environment variables

- Keep **`NEXT_PUBLIC_POCKETBASE_URL`** as today (public URL of the API).  
- Do **not** put secrets in `NEXT_PUBLIC_*`; the JWT is obtained at runtime and stored client-side.

### 3.5 Optional: server-side session (advanced)

If you later need **server components or Route Handlers** to call PocketBase with a user context, you would introduce cookies or a backend session and proxy requests — that is a larger change than “PocketBase auth as designed” on the client. For a first version, **client-only auth + API rules** is the usual pattern.

### 3.6 Web checklist

- [ ] Login and logout flows using `users` collection  
- [ ] Protected routes and redirect when `!pb.authStore.isValid` (and handle token expiry)  
- [ ] `vehicles` list/detail/realtime still work with new API rules  
- [ ] Error handling for wrong password, unverified email (if you enable verification)

---

## 4. Android app (`kotlin_gatems`) — align with the same backend

**Current state** (already in the codebase):

- `PocketBaseApi.authWithPassword(collection, email, password)` → `POST /api/collections/{collection}/auth-with-password` with JSON `identity` + `password` (matches PocketBase REST).
- `PocketBaseClient` adds `Authorization: Bearer <token>` when the token is non-blank.
- `AuthPreferences` persists token, user id, name, email, and optional PocketBase URL override.

### 4.1 Implementation steps

1. **Login screen**  
   Collect email + password; call `authWithPassword("users", email, password)` (or your auth collection slug if you rename it — default is `users`).

2. **After success**  
   - Parse `AuthResponse`: save `token` and `record` fields via `AuthPreferences.saveAuth(...)`.  
   - Call `PocketBaseClient.init(baseUrl, token)` and `setToken(token)` as your app already does on restore (`GateMsApp`).

3. **Logout**  
   - `clearAuth()`, `PocketBaseClient.clearToken()`, cancel realtime jobs if any, navigate to login.

4. **Startup**  
   - Restore token from DataStore → init client → if token invalid/expired, API will return 401; then clear auth and show login.

5. **Token refresh**  
   PocketBase issues JWTs with expiry. Options:  
   - Call **auth refresh** endpoint when you get 401 (PocketBase documents `auth-refresh` for the collection), or  
   - Re-login (simpler but worse UX).  
   The JS SDK refreshes automatically in many setups; on Android you should plan one explicit strategy.

6. **URL**  
   Use the same base URL as web (`BuildConfig.POCKETBASE_URL` / settings override) so users hit the same rules and data.

### 4.2 Kotlin checklist

- [ ] Login UI → `authWithPassword` → persist via `AuthPreferences`  
- [ ] All API calls use `PocketBaseClient` with token set  
- [ ] Logout clears storage and client token  
- [ ] Handle 401 globally (optional OkHttp interceptor) + refresh or re-auth  
- [ ] Realtime/SSE uses authenticated client if endpoints require auth  

---

## 5. Shared behaviour and “user control”

| Concern | Where to enforce |
|--------|-------------------|
| Who can read/write `vehicles` | PocketBase **API rules** on collections |
| Who can subscribe to realtime | Same auth; topic must allow `@request.auth` |
| Disable a user | PocketBase Admin → Users → delete or set rule that checks a `active` field |
| Password reset | PocketBase **Forgot password** flow + mail settings in PocketBase |
| Auditing | PocketBase logs + optional hooks |

Both apps only **store the JWT** and send it on requests; **authorization** stays on the server via rules.

---

## 6. Suggested implementation order

1. **PocketBase**: tighten rules on `vehicles` (and files) for authenticated users only; verify with Admin token or temporary test user.
2. **Next.js**: login page, auth store wiring, protect main routes, fix any broken list/realtime until green.
3. **Kotlin**: login screen wired to existing `authWithPassword` + `AuthPreferences`, then 401/refresh handling.
4. **Docs / ops**: document production URL, mail settings for reset, and admin procedure for onboarding users.

---

## 7. References

- PocketBase: [Authentication](https://pocketbase.io/docs/authentication/)  
- PocketBase JS: `authWithPassword`, `authStore` — see package `pocketbase` on npm  
- REST: `POST /api/collections/{collection}/auth-with-password` — already mirrored in `PocketBaseApi.kt`

---

*Last updated for repo layout: `webapp_nextjs/`, `kotlin_gatems/`.*
