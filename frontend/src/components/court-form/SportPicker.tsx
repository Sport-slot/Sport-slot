import { useState, type KeyboardEvent } from "react";
import { Check, Plus } from "@phosphor-icons/react";
import { FieldError, inputClass } from "@/components/form/fields";
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
  const options = [...popularSports, ...value.filter((sport) => !popularSports.some((known) => same(known, sport)))];

  function toggle(sport: string) {
    onChange(value.some((selected) => same(selected, sport)) ? value.filter((selected) => !same(selected, sport)) : [...value, sport]);
  }

  function addCustom() {
    const sport = custom.trim().toLocaleLowerCase("cs");
    if (!sport) return;
    if (!value.some((selected) => same(selected, sport))) onChange([...value, sport]);
    setCustom("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addCustom();
    }
  }

  return (
    <fieldset aria-describedby={error ? "court-sport-error court-sport-hint" : "court-sport-hint"}>
      <legend className="text-sm font-semibold text-foreground">Sport</legend>
      <p id="court-sport-hint" className="mt-1 text-xs text-muted">Vyberte jeden nebo více sportů, které se na kurtu dají hrát.</p>
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
      </div>
      <div className="mt-3 flex max-w-sm gap-2">
        <label htmlFor="court-sport-custom" className="sr-only">Jiný sport</label>
        <input
          id="court-sport-custom"
          type="text"
          className={`${inputClass} min-h-11 py-2 text-sm`}
          placeholder="Jiný sport, např. nohejbal"
          value={custom}
          maxLength={maxLength}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button type="button" onClick={addCustom} disabled={!custom.trim()} className="button button-outline min-h-11 shrink-0 gap-1.5 px-4 py-2 disabled:opacity-50">
          <Plus size={15} aria-hidden="true" /> Přidat
        </button>
      </div>
      <div className="mt-2">
        <FieldError id="court-sport-error">{error}</FieldError>
      </div>
    </fieldset>
  );
}
