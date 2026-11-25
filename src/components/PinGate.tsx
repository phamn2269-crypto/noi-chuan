import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PinGate({ check, title, hint, onOk }: { check: (pin: string) => boolean; title: string; hint?: string; onOk: () => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  return (
    <div className="mx-auto flex max-w-xs flex-col items-center py-10 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary">
        <Lock className="h-7 w-7" />
      </span>
      <h2 className="mt-3 text-xl font-extrabold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <form
        className="mt-4 w-full"
        onSubmit={(e) => {
          e.preventDefault();
          if (check(pin)) onOk();
          else {
            setErr(true);
            setPin("");
          }
        }}
      >
        <input
          value={pin}
          onChange={(e) => {
            setErr(false);
            setPin(e.target.value);
          }}
          type="password"
          autoFocus
          className="h-14 w-full rounded-2xl border-2 border-input bg-card text-center text-2xl tracking-[0.5em] outline-none focus:border-primary"
          aria-label="Mã"
        />
        {err && <p className="mt-2 text-sm font-semibold text-destructive">Mã chưa đúng</p>}
        <Button className="mt-3 w-full" type="submit">
          Mở
        </Button>
      </form>
    </div>
  );
}
