"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/server/auth/context";
import { cancelPromise } from "@/server/services/promises";

export async function cancelPromiseAction(formData: FormData): Promise<void> {
  const context = await requirePermission("collections.update");
  const parsed = z
    .object({ promiseId: z.string().min(1) })
    .safeParse({ promiseId: String(formData.get("promiseId") ?? "") });

  if (!parsed.success) return;

  await cancelPromise({
    companyId: context.companyId,
    promiseId: parsed.data.promiseId,
  });

  revalidatePath("/promises");
  // The route screen shows the same promise on its stop.
  revalidatePath("/collections");
}
