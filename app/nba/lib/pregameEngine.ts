import { readClosingStatus, saveClosingStatus } from "./closingStatus";

export function shouldReviewPregame(startTime: string, minutesBefore = 30) {
  const now = new Date();
  const gameTime = new Date(startTime);

  const diffMs = gameTime.getTime() - now.getTime();
  const reviewWindowMs = minutesBefore * 60 * 1000;

  // ✅ revisa hasta 30 min antes 
  return diffMs <= reviewWindowMs && diffMs >= -10 * 60 * 1000;
}

export function getPregameStatus(pick: any) {
  if (pick?.clvTrap?.trap) {
    return {
      status: "REMOVED",
      reason: "CLV_TRAP",
    };
  }

  // REMOVED solo si va contra closing Y no hay soporte real
if (
  pick?.againstClosing &&
  (pick?.pressure ?? 50) < 55 &&
  (pick?.sharpConsensus?.score ?? 0) < 60
) {
  return {
    status: "REMOVED",
    reason: "AGAINST_CLOSING_NO_SUPPORT",
  };
}

  if ((pick?.confidence ?? 0) < 55) {
    return {
      status: "DOWNGRADED",
      reason: "LOW_CONFIDENCE",
    };
  }

  if ((pick?.valuePriority ?? 0) < 90) {
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

    // ✅ solo congelar después de que el juego haya arrancado
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