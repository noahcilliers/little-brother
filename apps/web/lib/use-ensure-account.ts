"use client";

import { useMutation } from "convex/react";
import { useEffect, useRef } from "react";
import { api, type Me } from "./api";

/** The member row is created lazily: the first signed-in page view after GitHub sign-in makes it. */
export function useEnsureAccount(me: Me | undefined): void {
  const ensure = useMutation(api.team.ensureAccount);
  const asked = useRef(false);
  useEffect(() => {
    if (!me || me.member || asked.current) return;
    asked.current = true;
    ensure({}).catch(() => {
      asked.current = false;
    });
  }, [me, ensure]);
}
