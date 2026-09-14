import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/ProfileForm";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <ProfileForm
        userId={user.id}
        email={user.email ?? ""}
        initial={
          profile
            ? { full_name: profile.full_name, student_id: profile.student_id, phone: profile.phone }
            : null
        }
      />
    </div>
  );
}
