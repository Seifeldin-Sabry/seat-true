import { Button, Input, Label } from "@seattrue/ui";
import { Link } from "@tanstack/react-router";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import type { FormEvent } from "react";
import { useRef, useState } from "react";
import {
  getPlanPreflight,
  type PlanId,
  type PlanPreflight,
  useChangePlan,
} from "../lib/billing";

const CONFIRMATION = "DOWNGRADE";

function formatDate(value: string | null) {
  if (!value) return "the end of the current period";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

/**
 * Plan switching lives in the app (not the Stripe portal) so a downgrade can
 * check usage first. Upgrades apply now; downgrades apply at period end.
 */
export function PlanChange({
  currentPlanId,
  scheduledPlanId,
  periodEnd,
}: {
  currentPlanId: PlanId | null;
  scheduledPlanId: PlanId | null;
  periodEnd: string | null;
}) {
  const change = useChangePlan();
  const dialog = useRef<HTMLDialogElement>(null);
  const [preflight, setPreflight] = useState<PlanPreflight | null>(null);
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [typed, setTyped] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function startDowngrade() {
    setNotice(null);
    setLoadError(null);
    try {
      const result = await getPlanPreflight("starter");
      setPreflight(result);
      setKeep(new Set(result.defaultKeepClientIds));
      setTyped("");
      change.reset();
      dialog.current?.showModal();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Try again.");
    }
  }

  async function upgrade() {
    setNotice(null);
    try {
      await change.mutateAsync({ plan: "pro" });
      setNotice("You're on Pro now. Every client is unlocked.");
    } catch {
      // Shown via change.error.
    }
  }

  async function confirmDowngrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preflight) return;
    const overage = preflight.overages.length > 0;
    try {
      await change.mutateAsync({
        plan: "starter",
        ...(overage ? { keepClientIds: [...keep], confirm: typed } : {}),
      });
      dialog.current?.close();
      setNotice(`Switching to Starter on ${formatDate(periodEnd)}.`);
    } catch {
      // Shown via change.error.
    }
  }

  const limit = preflight?.limit ?? null;
  const overage = (preflight?.overages.length ?? 0) > 0;
  const clientOverage = preflight?.overages.find(
    (entry) => entry.kind === "clients",
  );
  const lockedNames =
    preflight?.clients.filter((client) => !keep.has(client.id)) ?? [];
  const keepValid = limit === null || keep.size <= limit;
  const canConfirm =
    !overage ||
    (keepValid && (!clientOverage || keep.size > 0) && typed === CONFIRMATION);

  return (
    <section
      className="recon-panel"
      aria-labelledby="plan-change-title"
      style={{ marginTop: 16 }}
    >
      <h2 id="plan-change-title">Change plan</h2>
      {scheduledPlanId === "starter" ? (
        <p>
          Switching to Starter on {formatDate(periodEnd)}. Upgrading to Pro
          cancels the switch.
        </p>
      ) : (
        <p>
          Upgrades take effect now and are invoiced immediately. Downgrades
          start at the end of the period you've paid for. No refunds; cancel
          anytime and keep access until the end of the paid period.
        </p>
      )}
      {notice && (
        <p className="notice-banner" role="status">
          {notice}
        </p>
      )}
      {(change.error || loadError) && (
        <p className="dialog-error" role="alert">
          {change.error?.message ?? loadError}
        </p>
      )}
      <div className="recon-actions">
        {currentPlanId === "pro" && scheduledPlanId !== "starter" && (
          <Button type="button" variant="outline" onClick={startDowngrade}>
            Switch to Starter
          </Button>
        )}
        {(currentPlanId === "starter" || scheduledPlanId === "starter") && (
          <Button type="button" onClick={upgrade} disabled={change.isPending}>
            {change.isPending && (
              <LoaderCircle size={16} className="spin" aria-hidden="true" />
            )}
            {currentPlanId === "pro" ? "Stay on Pro" : "Upgrade to Pro"}
          </Button>
        )}
      </div>

      <dialog
        ref={dialog}
        className="app-dialog"
        aria-labelledby="downgrade-title"
      >
        <form onSubmit={confirmDowngrade}>
          <div className="dialog-heading">
            <div>
              <span className="section-kicker">Downgrade to Starter</span>
              <h2 id="downgrade-title">
                {overage ? "Some clients will be locked" : "Switch to Starter"}
              </h2>
              <p>
                Takes effect {formatDate(periodEnd)}. You keep Pro until then.
              </p>
            </div>
          </div>

          {preflight && !overage && (
            <p>
              You have {preflight.clients.length} active clients, within
              Starter's {limit ?? "unlimited"}. Nothing will be locked.
            </p>
          )}

          {preflight && overage && (
            <>
              {clientOverage && (
                <div className="error-banner" role="alert">
                  <TriangleAlert size={18} aria-hidden="true" />
                  <div>
                    <strong>{clientOverage.summary}</strong>
                    <p>
                      {lockedNames.length} clients will become read-only and be
                      left out of reconciliation. Nothing is deleted; they
                      unlock when you upgrade.
                    </p>
                  </div>
                </div>
              )}
              {clientOverage && (
                <fieldset className="field-stack">
                  <legend>
                    Keep these {keep.size} of {limit} (least recently active are
                    unchecked by default)
                  </legend>
                  <div style={{ maxHeight: 240, overflowY: "auto" }}>
                    {preflight.clients.map((client) => (
                      <label
                        key={client.id}
                        style={{ display: "flex", gap: 8 }}
                      >
                        <input
                          type="checkbox"
                          checked={keep.has(client.id)}
                          onChange={(event) =>
                            setKeep((current) => {
                              const next = new Set(current);
                              if (event.target.checked) next.add(client.id);
                              else next.delete(client.id);
                              return next;
                            })
                          }
                        />
                        {client.name}
                      </label>
                    ))}
                  </div>
                  {!keepValid && (
                    <p className="dialog-error" role="alert">
                      Starter keeps at most {limit} clients. Uncheck{" "}
                      {keep.size - (limit ?? 0)} more.
                    </p>
                  )}
                  <p>
                    Will be locked:{" "}
                    {lockedNames.map((client) => client.name).join(", ") ||
                      "none"}
                  </p>
                </fieldset>
              )}
              <div className="field-group">
                <Label htmlFor="downgrade-confirm">
                  Type {CONFIRMATION} to confirm
                </Label>
                <Input
                  id="downgrade-confirm"
                  autoComplete="off"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                />
              </div>
              <p>
                Prefer a clean downgrade?{" "}
                <Link to="/app">Archive clients first</Link>, then come back.
              </p>
            </>
          )}

          {change.error && (
            <p className="dialog-error" role="alert">
              {change.error.message}
            </p>
          )}
          <div className="dialog-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => dialog.current?.close()}
            >
              Keep Pro
            </Button>
            <Button
              type="submit"
              variant={overage ? "destructive" : "default"}
              disabled={!canConfirm || change.isPending}
            >
              {change.isPending && (
                <LoaderCircle size={16} className="spin" aria-hidden="true" />
              )}
              Schedule downgrade
            </Button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
