import { AppError, notAuthenticated, notAuthorized } from "@sportslot/api-format";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function managerIdFromGateway(req, gatewaySecret) {
  if (typeof gatewaySecret !== "string" || gatewaySecret.length < 32) {
    throw new AppError(
      "gatewayUnavailable",
      "Ověření gateway není nakonfigurováno.",
      503,
    );
  }

  if (req.get("x-gateway-secret") !== gatewaySecret) {
    throw notAuthenticated();
  }

  const userId = req.get("x-user-id");
  const roles = (req.get("x-user-roles") ?? "").split(",");

  if (!userId || !UUID_PATTERN.test(userId)) {
    throw notAuthenticated();
  }

  if (!roles.includes("PLAYER") || !roles.includes("MANAGER")) {
    throw notAuthorized();
  }

  return userId;
}
