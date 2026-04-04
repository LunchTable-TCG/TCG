import { query } from "./_generated/server";
import { isOperatorUser, requireViewerUser } from "./lib/viewer";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const user = await requireViewerUser(ctx);

    const wallet = user.primaryWalletId
      ? await ctx.db.get(user.primaryWalletId)
      : null;

    return {
      email: user.email,
      id: user._id,
      isOperator: isOperatorUser(user),
      username: user.username,
      walletAddress:
        wallet?.address ??
        (typeof identity.wallet_address === "string"
          ? identity.wallet_address
          : null),
    };
  },
});
