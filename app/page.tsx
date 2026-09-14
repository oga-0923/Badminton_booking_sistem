import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HomeIntro } from "@/components/HomeIntro";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/reserve");

  return <HomeIntro />;
}
