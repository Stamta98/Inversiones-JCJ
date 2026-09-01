"use client";

import { Alert, Button, CardBody, Field, Input, Select } from "@/components/ui";
import { es } from "@/i18n/es";
import { useFormAction } from "@/lib/use-form-action";

import { createRoute, type RouteFormState } from "./actions";

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? es.common.saving : es.collections.new}
    </Button>
  );
}

export function RouteForm({
  collectors,
}: {
  collectors: Array<{ id: string; label: string }>;
}) {
  const { state, pending, onSubmit } = useFormAction<RouteFormState>(createRoute, {});

  return (
    <form onSubmit={onSubmit}>
      <CardBody className="grid gap-4 sm:grid-cols-2">
        {state.error ? (
          <div className="sm:col-span-2">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        ) : null}

        <Field label={es.collections.routeName} htmlFor="routeName" required>
          <Input id="routeName" name="name" required />
        </Field>

        <Field label={es.collections.scheduledFor} htmlFor="scheduledFor">
          <Input
            id="scheduledFor"
            name="scheduledFor"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </Field>

        <Field label={es.collections.collector} htmlFor="collectorId">
          <Select id="collectorId" name="collectorId" defaultValue="">
            <option value="">{es.common.none}</option>
            {collectors.map((collector) => (
              <option key={collector.id} value={collector.id}>
                {collector.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={es.common.filter} htmlFor="source">
          <Select id="source" name="source" defaultValue="due">
            <option value="due">{es.dashboard.dueTodayTitle}</option>
            <option value="arrears">{es.dashboard.arrearsTitle}</option>
          </Select>
        </Field>

        <div className="sm:col-span-2 flex justify-end">
          <SubmitButton pending={pending} />
        </div>
      </CardBody>
    </form>
  );
}
