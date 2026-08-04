"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { signOutAction } from "@/actions/auth.actions";

/**
 * Sign out.
 *
 * A POST-shaped action rather than a `/sign-out` link, deliberately: a GET that
 * ends a session can be triggered by any image tag on any page a visitor loads,
 * which is a logout CSRF. Server Actions carry Next's own protection and cannot
 * be invoked by navigation.
 *
 * `router.refresh()` before navigating, so the header re-renders signed-out on
 * the page we land on. Without it the visitor arrives home still looking logged
 * in until something else happens to revalidate.
 *
 * A failed sign-out still navigates home. The cookie is cleared by the response
 * either way, and leaving somebody on an account page after they asked to leave
 * is worse than a redirect that was not strictly necessary.
 */
export function SignOutButton({
  variant = "outline",
}: {
  variant?: "outline" | "ghost" | "default";
}) {
  const t = useTranslations("account");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant={variant}
      disabled={pending}
      aria-busy={pending}
      onClick={() =>
        startTransition(async () => {
          await signOutAction({});
          router.refresh();
          router.push(routes.home);
        })
      }
    >
      <LogOut aria-hidden="true" />
      {pending ? t("signingOut") : t("signOut")}
    </Button>
  );
}
