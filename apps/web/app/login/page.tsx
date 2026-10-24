import { api } from "@lb/backend/api";
import { fetchQuery } from "convex/nextjs";
import type { Metadata } from "next";
import "@/styles/ui.css";
import "@/styles/auth.css";
import { GrainPanel } from "@/components/auth/grain-panel";
import { SignIn } from "@/components/auth/sign-in";
import { afterLogin } from "@/lib/after-login";

export const metadata: Metadata = { title: "Log in · Little Brother" };

type Props = { searchParams: Promise<{ next?: string; invite?: string }> };

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

export default async function LoginPage({ searchParams }: Props) {
  const { next, invite } = await searchParams;
  const [status, room] = await Promise.all([
    safe(fetchQuery(api.team.status, {})),
    invite ? safe(fetchQuery(api.rooms.preview, { invite })) : null,
  ]);
  const ready = status?.signInReady ?? true;
  return (
    <div className="auth">
      <section className="auth-side">
        <a className="wordmark" href="/">
          little brother<i aria-hidden="true">▍</i>
        </a>
        <div className="auth-form">
          <h1>Welcome to Little Brother</h1>
          <p className="auth-sub">
            {room ? (
              <>
                Log in to join <b>{room.name}</b>
              </>
            ) : (
              "Log in or sign up"
            )}
          </p>
          <SignIn redirectTo={afterLogin(next, invite)} disabled={!ready} />
          {!ready ? (
            <div className="auth-note">
              <p>Sign-in isn't configured on this deployment ({status?.missing.join(", ")}).</p>
              {status?.openMode ? <a href="/app">Continue in local open mode →</a> : null}
            </div>
          ) : null}
        </div>
        <p className="auth-foot">Only your GitHub login and avatar are used.</p>
      </section>
      <aside className="auth-art">
        <GrainPanel />
      </aside>
    </div>
  );
}
