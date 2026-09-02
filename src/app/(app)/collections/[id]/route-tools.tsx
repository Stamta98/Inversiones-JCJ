"use client";

import { Alert, Button, CardBody, Field, Select } from "@/components/ui";
import { es } from "@/i18n/es";
import { useFormAction } from "@/lib/use-form-action";

import {
  addStopAction,
  assignRouteAction,
  closeRouteAction,
  deleteRouteAction,
  reopenRouteAction,
  type RouteFormState,
} from "../actions";

function Feedback({ state }: { state: RouteFormState }) {
  if (state.error) return <Alert tone="danger">{state.error}</Alert>;
  if (state.success)
    return (
      <Alert tone="positive" icon="check">
        {state.success}
      </Alert>
    );
  return null;
}

export function AssignRouteForm({
  routeId,
  collectors,
  currentCollectorId,
}: {
  routeId: string;
  collectors: Array<{ id: string; label: string }>;
  currentCollectorId: string;
}) {
  const { state, pending, onSubmit } = useFormAction<RouteFormState>(
    assignRouteAction,
    {},
  );

  return (
    <form method="post" onSubmit={onSubmit}>
      <CardBody className="space-y-3">
        <input type="hidden" name="routeId" value={routeId} />
        <Feedback state={state} />

        <Field label={es.collections.assignCollector} htmlFor="collectorId">
          <Select
            id="collectorId"
            name="collectorId"
            defaultValue={currentCollectorId}
          >
            <option value="">{es.collections.unassigned}</option>
            {collectors.map((collector) => (
              <option key={collector.id} value={collector.id}>
                {collector.label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={pending}
          >
            {pending ? es.common.saving : es.common.save}
          </Button>
        </div>
      </CardBody>
    </form>
  );
}

export function AddStopForm({
  routeId,
  loans,
}: {
  routeId: string;
  loans: Array<{ id: string; label: string }>;
}) {
  const { state, pending, onSubmit } = useFormAction<RouteFormState>(
    addStopAction,
    {},
  );

  return (
    <form method="post" onSubmit={onSubmit}>
      <CardBody className="space-y-3">
        <input type="hidden" name="routeId" value={routeId} />
        <Feedback state={state} />

        <Field
          label={es.loans.singular}
          htmlFor="loanId"
          hint={es.collections.addStopHint}
        >
          <Select id="loanId" name="loanId" defaultValue="" required>
            <option value="" disabled>
              {es.common.selectOne}
            </option>
            {loans.map((loan) => (
              <option key={loan.id} value={loan.id}>
                {loan.label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            icon="plus"
            disabled={pending}
          >
            {pending ? es.common.saving : es.common.add}
          </Button>
        </div>
      </CardBody>
    </form>
  );
}

/** Closing, reopening and deleting: plain forms, no state to keep. */
export function RouteLifecycle({
  routeId,
  closed,
  canDelete,
}: {
  routeId: string;
  closed: boolean;
  canDelete: boolean;
}) {
  return (
    <CardBody className="flex flex-wrap gap-2">
      <form action={closed ? reopenRouteAction : closeRouteAction}>
        <input type="hidden" name="routeId" value={routeId} />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          icon={closed ? "route" : "check"}
        >
          {closed ? es.collections.reopenRoute : es.collections.finishRoute}
        </Button>
      </form>

      {canDelete ? (
        <form
          action={deleteRouteAction}
          onSubmit={(event) => {
            if (!window.confirm(es.collections.deleteRouteConfirm)) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="routeId" value={routeId} />
          <Button type="submit" size="sm" variant="ghost" icon="trash">
            {es.collections.deleteRoute}
          </Button>
        </form>
      ) : null}
    </CardBody>
  );
}
