import "server-only";

import { unstable_rethrow } from "next/navigation";

import { clearClaimTokens, readClaimTokens } from "@/lib/orders/claim-cookie";
import { logger } from "@/lib/logger";
import { createClient } from "@/supabase/server";
import * as ordersService from "@/services/orders.service";

/**
 * Attaches any guest orders this browser is holding to the signed-in account.
 *
 * Called wherever a session comes into existence — after the email verification
 * link is exchanged, and after a sign-in. Both, rather than only registration,
 * because the shopper who taps "Maybe later" and signs in a week from now has
 * exactly the same claim and the same right to it.
 *
 * **Never throws.** Claiming is an improvement to somebody's account, not a
 * precondition for having one: a failure here must not turn a successful
 * verification into an error page. It is logged loudly instead, because a
 * customer whose order silently failed to appear will contact support and
 * somebody will need this line.
 */
export async function claimPendingOrders(): Promise<number> {
  try {
    const supabase = await createClient();
    const tokens = await readClaimTokens();

    // **Token first, always.** It is the stronger proof — a capability this
    // browser was issued, rather than an address it typed — so it is tried
    // before the email path even when both would match the same order.
    const byToken =
      tokens.length > 0 ? await ordersService.claimOrders(supabase, tokens) : 0;

    // Then anything left over that was placed with an address this account has
    // since verified (ADR-71). Runs even when no token was held: the customer
    // who ordered on their phone and registered on a laptop has no cookie.
    const byEmail = await ordersService.claimOrdersByEmail(supabase);
    const claimed = byToken + byEmail;

    // Cleared whichever way it went. The tokens are spent server-side on a
    // successful claim, and a token that matched nothing will never match
    // anything later either.
    await clearClaimTokens();

    if (claimed > 0) {
      logger.info("attached guest orders to a new account", {
        claimed,
        byToken,
        byEmail,
      });
    }

    return claimed;
  } catch (error) {
    unstable_rethrow(error);

    logger.error("could not attach guest orders to the account", error);

    return 0;
  }
}
