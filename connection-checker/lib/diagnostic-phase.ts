/** Индекс этапа по `phase` (-1 если не распознано); порядок как у STEPS в diagnostic-timeline. */
export function phaseStringToStepIndex(phase: string | null): number {
  if (!phase) return -1;
  const p = phase.toLowerCase();
  if (p.includes("сброс")) return 0;
  if (p.includes("последовательный rtt")) return 0;
  if (p.includes("burst")) return 1;
  if (p.includes("https downlink") || p.includes("jsdelivr")) return 2;
  if (p.includes("доступность хостов")) return 3;
  if (p.includes("белый список")) return 4;
  return -1;
}

export type StepVisualState = "pending" | "active" | "done";

export function getStepVisualState(
  stepIndex: number,
  opts: {
    running: boolean;
    phase: string | null;
    /** Успешно завершён полный сценарий до конца */
    completedFullRun: boolean;
    /** Последний достигнутый индекс при обрыве (-1 если не применимо) */
    partialMaxIndex: number;
  }
): StepVisualState {
  const { running, phase, completedFullRun, partialMaxIndex } = opts;

  if (completedFullRun) {
    return "done";
  }

  if (running) {
    let cur = phaseStringToStepIndex(phase);
    if (cur < 0) cur = 0;
    if (stepIndex < cur) return "done";
    if (stepIndex === cur) return "active";
    return "pending";
  }

  if (partialMaxIndex >= 0) {
    if (stepIndex <= partialMaxIndex) return "done";
  }

  return "pending";
}
