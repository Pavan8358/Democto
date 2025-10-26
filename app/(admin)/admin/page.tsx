import { redirect } from "next/navigation";

import { Role } from "@prisma/client";

import { requireRole } from "@/lib/auth";

export default async function AdminRedirectPage() {
  await requireRole(Role.ADMIN, { redirectTo: "/admin" });

  redirect("/admin/exams");
}
