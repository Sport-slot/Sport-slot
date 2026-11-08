import { Check } from "@phosphor-icons/react";
import { wizardSteps } from "./steps";

export function WizardStepper({
  current,
  reachable,
  completed,
  onSelect,
}: {
  current: number;
  reachable: number;
  completed: (index: number) => boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="Postup založení sportoviště">
      <p className="flex items-baseline justify-between gap-3 text-sm sm:hidden">
        <span className="font-semibold text-foreground">{wizardSteps[current].short}</span>
        <span className="text-muted tabular-nums">{current + 1} ze {wizardSteps.length}</span>
      </p>
      <ol className="mt-3 grid grid-cols-4 gap-1.5 sm:mt-0 sm:gap-6">
        {wizardSteps.map((step, index) => {
          const isCurrent = index === current;
          const isDone = !isCurrent && completed(index);
          const enabled = index <= reachable && !isCurrent;
          return (
            <li key={step.id} className="min-w-0">
              <button
                type="button"
                disabled={!enabled}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onSelect(index)}
                className="group flex w-full min-w-0 flex-col gap-2.5 text-left disabled:cursor-default"
              >
                <span
                  aria-hidden="true"
                  className={`h-1 w-full rounded-full transition-colors duration-300 ${
                    isCurrent ? "bg-brand-500" : isDone ? "bg-foreground/70" : "bg-line"
                  }`}
                />
                <span
                  className={`hidden min-h-6 items-center gap-1.5 truncate text-sm sm:flex ${
                    isCurrent ? "font-semibold text-foreground" : isDone ? "text-foreground/80" : "text-muted"
                  } ${enabled ? "group-hover:text-foreground" : ""}`}
                >
                  {isDone && <Check size={14} weight="bold" className="shrink-0 text-brand-500" aria-hidden="true" />}
                  {step.short}
                  {isDone && <span className="sr-only"> (hotovo)</span>}
                </span>
                <span className="sr-only sm:hidden">{step.short}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
