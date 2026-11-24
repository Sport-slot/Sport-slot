import { useRef, useState, type KeyboardEvent } from "react";
import { Check, Plus, X } from "@phosphor-icons/react";
import { FieldError } from "@/components/form/fields";
import { capitalize, popularSports } from "@/lib/venueVisuals";

function same(a: string, b: string): boolean {
  return a.toLocaleLowerCase("cs") === b.toLocaleLowerCase("cs");
}

export function SportPicker({
  value,
  error,
  maxLength,
  onChange,
}: {
  value: string[];
  error?: string;
  maxLength: number;
  onChange: (sports: string[]) => void;
}) {
  const [custom, setCustom] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const customRef = useRef<HTMLInputElement>(null);
  const options = [...popularSports, ...value.filter((sport) => !popularSports.some((known) => same(known, sport)))];

  function toggle(sport: string) {
    onChange(value.some((selected) => same(selected, sport)) ? value.filter((selected) => !same(selected, sport)) : [...value, sport]);
  }

  function addCustom() {
    const sport = custom.trim().toLocaleLowerCase("cs");
    if (!sport) return;
    if (!value.some((selected) => same(selected, sport))) onChange([...value, sport]);
    setCustom("");
    setAddingCustom(false);
  }

  function openCustom() {
    setAddingCustom(true);
    requestAnimationFrame(() => customRef.current?.focus());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addCustom();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setCustom("");
      setAddingCustom(false);
    }
  }

  return (
    <fieldset aria-describedby={error ? "court-sport-error court-sport-hint" : "court-sport-hint"}>
      <legend className="text-sm font-semibold text-foreground">Sport</legend>
      <p id="court-sport-hint" className="mt-1 text-sm text-muted">Na multifunkčním kurtu vyberte všechny sporty, které se na něm hrají.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((sport) => {
          const selected = value.some((item) => same(item, sport));
          return (
            <button
              key={sport}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(sport)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors ${
                selected ? "border-foreground bg-foreground text-page" : "border-line hover:bg-surface"
              } ${error ? "border-red-600" : ""}`}
            >
              {selected && <Check size={14} weight="bold" aria-hidden="true" />}
              {capitalize(sport)}
            </button>
          );
        })}
        {addingCustom ? (
          <span className="inline-flex min-h-11 items-center gap-1 rounded-full border border-foreground pr-1 pl-4">
            <label htmlFor="court-sport-custom" className="sr-only">Jiný sport</label>
            <input
              ref={customRef}
              id="court-sport-custom"
              type="text"
              className="w-36 bg-transparent text-sm outline-none placeholder:text-muted/70"
              placeholder="např. nohejbal"
              value={custom}
              maxLength={maxLength}
              onChange={(event) => setCustom(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button type="button" onClick={addCustom} disabled={!custom.trim()} aria-label="Přidat sport" className="flex size-9 items-center justify-center rounded-full bg-foreground text-page transition-opacity disabled:opacity-30">
              <Check size={15} weight="bold" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => { setCustom(""); setAddingCustom(false); }} aria-label="Zrušit" className="flex size-9 items-center justify-center rounded-full text-muted hover:text-foreground">
              <X size={15} aria-hidden="true" />
            </button>
          </span>
        ) : (
          <button type="button" onClick={openCustom} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-line px-4 text-sm font-medium text-muted transition-colors hover:border-foreground hover:text-foreground">
            <Plus size={14} aria-hidden="true" /> Jiný sport
          </button>
        )}
      </div>
      <div className="mt-2">
        <FieldError id="court-sport-error">{error}</FieldError>
      </div>
    </fieldset>
  );
}
