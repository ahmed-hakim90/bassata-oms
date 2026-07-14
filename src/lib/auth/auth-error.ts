/** Shared auth failure type — keep free of repository imports to avoid cycles. */
export class AuthError extends Error {
  constructor(
    message: string,
    public status = 403
  ) {
    super(message);
    this.name = "AuthError";
  }
}
