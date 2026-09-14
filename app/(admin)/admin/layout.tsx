import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (!profile || (profile.role !== "staff" && profile.role !== "admin")) {
    redirect("/reserve");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <AdminNav isAdmin={profile.role === "admin"} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
