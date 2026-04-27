import { readClosingStatus, saveClosingStatus } from "./closingStatus";

export function shouldReviewPregame(startTime: string, minutesBefore = 30) {
  const now = new Date();
  const gameTime = new Date(startTime);

  const diffMs = gameTime.getTime() - now.getTime();
  const reviewWindowMs = minutesBefore * 60 * 1000;

  // ✅ revisa hasta 30 min antes y deja 10 min de tolerancia después
  return diffMs <= reviewWindowMs && diffMs >= -10 * 60 * 1000;
}

export function getPregameStatus(pick: any) {
  const confidence = pick?.confidence ?? 0;
  const valuePriority = pick?.valuePriority ?? 0;
  const marketPressure = pick?.marketPressure ?? 50;
  const sharpConsensus = pick?.sharpConsensus ?? 50;

  if (pick?.clvTrap?.trap) {
    return {
      status: "REMOVED",
      reason: "CLV_TRAP",
    };
  }

  // 🟢 Si el mercado se movió a favor, se confirma
  if (pick?.closingDirection === "up") {
    return {
      status: "CONFIRMED",
      reason: "MARKET_MOVED_IN_FAVOR",
    };
  }

  // 🔴 Si va contra closing Y no hay soporte real, se remueve
  if (
    pick?.closingDirection === "down" &&
    marketPressure < 55 &&
    sharpConsensus < 60
  ) {
    return {
      status: "REMOVED",
      reason: "AGAINST_CLOSING_NO_SUPPORT",
    };
  }

  // 🟡 Si va contra closing pero todavía hay soporte, solo downgrade
  if (
    pick?.closingDirection === "down" &&
    (marketPressure >= 55 || sharpConsensus >= 60)
  ) {
    return {
      status: "DOWNGRADED",
      reason: "AGAINST_CLOSING_WITH_SUPPORT",
    };
  }

  if (confidence < 55) {
    return {
      status: "DOWNGRADED",
      reason: "LOW_CONFIDENCE",
    };
  }

  if (valuePriority < 80) {
    return {
      status: "DOWNGRADED",
      reason: "LOW_VALUE_PRIORITY",
    };
  }

  return {
    status: "CONFIRMED",
    reason: "PASSED_CHECKS",
  };
}

export function evaluatePregamePool(picks: any[], minutesBefore = 30) {
  const statusMap: Record<string, any> = {};
  const previousStatusMap = readClosingStatus();

  const evaluated = (picks ?? []).map((pick) => {
    const pickKey = String(pick.id ?? pick.gameId ?? "");
    const previousStatus = previousStatusMap[pickKey]?.status;

    const gameTime = new Date(pick.startTime);
    const now = new Date();
    const gameStarted = now.getTime() >= gameTime.getTime();

    // ✅ solo congelar después de que el juego haya empezado
    if (
      gameStarted &&
      (
        previousStatus === "CONFIRMED" ||
        previousStatus === "REMOVED" ||
        previousStatus === "DOWNGRADED"
      )
    ) {
      statusMap[pickKey] = {
        status: previousStatus,
        reason: previousStatusMap[pickKey]?.reason ?? "LOCKED_STATUS",
        awayTeam: pick.awayTeam ?? null,
        homeTeam: pick.homeTeam ?? null,
        pickLabel: pick.pickLabel ?? null,
        startTime: pick.startTime ?? null,
      };

      return {
        ...pick,
        status: previousStatus,
        reviewReason: previousStatusMap[pickKey]?.reason ?? "LOCKED_STATUS",
      };
    }

    const shouldReview = shouldReviewPregame(pick.startTime, minutesBefore);

    if (!shouldReview) {
      statusMap[pickKey] = {
        status: "PENDING",
        reason: "WAITING_WINDOW",
        awayTeam: pick.awayTeam ?? null,
        homeTeam: pick.homeTeam ?? null,
        pickLabel: pick.pickLabel ?? null,
        startTime: pick.startTime ?? null,
      };

      return {
        ...pick,
        status: "PENDING",
        reviewReason: "WAITING_WINDOW",
      };
    }

    const result = getPregameStatus(pick);

    if (pickKey) {
      statusMap[pickKey] = {
        status: result.status,
        reason: result.reason,
        awayTeam: pick.awayTeam ?? null,
        homeTeam: pick.homeTeam ?? null,
        pickLabel: pick.pickLabel ?? null,
        startTime: pick.startTime ?? null,
      };
    }

    return {
      ...pick,
      status: result.status,
      reviewReason: result.reason,
      reviewedAt: new Date().toISOString(),
    };
  });

  saveClosingStatus(statusMap);

  return evaluated;
}