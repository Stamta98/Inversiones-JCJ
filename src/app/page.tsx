import { redirect } from "next/navigation";

import { getAuthContext } from "@/server/auth/context";

export default async function IndexPage() {
  const context = await getAuthContext();
  redirect(context ? "/dashboard" : "/login");
}
