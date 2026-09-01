"use client";

import { useState } from "react";

import { Field, Select } from "@/components/ui";
import {
  PAYDAY_KINDS,
  needsDayOfMonth,
  needsWeekday,
  type PaydayKind,
} from "@/core/customers/payday";
import { WEEKDAYS } from "@/core/types";
import { es } from "@/i18n/es";

/** Days of the month people are actually paid on. */
const DAYS_OF_MONTH = Array.from({ length: 31 }, (_, index) => index + 1);

export function PaydayFields({
  defaultKind = "",
  defaultWeekday,
  defaultDayOfMonth,
}: {
  defaultKind?: PaydayKind | "";
  defaultWeekday?: number | null;
  defaultDayOfMonth?: number | null;
}) {
  const [kind, setKind] = useState<PaydayKind | "">(defaultKind);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={es.customers.paydayKind} htmlFor="paydayKind">
        <Select
          id="paydayKind"
          name="paydayKind"
          value={kind}
          onChange={(event) => setKind(event.target.value as PaydayKind | "")}
        >
          <option value="">{es.common.selectOne}</option>
          {PAYDAY_KINDS.map((option) => (
            <option key={option} value={option}>
              {es.customers.paydayKindLabel[option]}
            </option>
          ))}
        </Select>
      </Field>

      {needsWeekday(kind || null) ? (
        <Field label={es.customers.paydayWeekday} htmlFor="paydayWeekday">
          <Select
            id="paydayWeekday"
            name="paydayWeekday"
            defaultValue={String(defaultWeekday ?? 5)}
          >
            {WEEKDAYS.map((day) => (
              <option key={day} value={day}>
                {es.loans.weekday[String(day) as "0"]}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {needsDayOfMonth(kind || null) ? (
        <Field label={es.customers.paydayDayOfMonth} htmlFor="paydayDayOfMonth">
          <Select
            id="paydayDayOfMonth"
            name="paydayDayOfMonth"
            defaultValue={String(defaultDayOfMonth ?? 30)}
          >
            {DAYS_OF_MONTH.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
    </div>
  );
}
