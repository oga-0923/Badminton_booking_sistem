import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RentalForm } from "@/components/RentalForm";

export default async function RentalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("student_id, is_fee_exempt")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/profile");

  const [{ data: equipment }, { data: allLoans }, { data: myLoans }, { data: settings }, { data: verified }] =
    await Promise.all([
      supabase.from("equipment").select("*").order("type"),
      supabase.from("equipment_loans").select("equipment_id, quantity").eq("status", "borrowed"),
      supabase
        .from("equipment_loans")
        .select("id, equipment_id, quantity, status, fee_amount, borrowed_at")
        .eq("user_id", user.id)
        .order("borrowed_at", { ascending: false }),
      supabase.from("venue_settings").select("rental_fee_per_item").eq("id", 1).single(),
      supabase.rpc("is_verified_student", { p_user_id: user.id }),
    ]);

  const isFree = Boolean(verified) || Boolean(profile.is_fee_exempt);

  const borrowedByEquipment = new Map<string, number>();
  for (const loan of allLoans ?? []) {
    borrowedByEquipment.set(loan.equipment_id, (borrowedByEquipment.get(loan.equipment_id) ?? 0) + loan.quantity);
  }

  const equipmentWithAvailability = (equipment ?? []).map((e) => ({
    ...e,
    available: e.total_quantity - (borrowedByEquipment.get(e.id) ?? 0),
  }));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <RentalForm
        equipment={equipmentWithAvailability}
        myLoans={myLoans ?? []}
        isFree={isFree}
        feePerItem={settings?.rental_fee_per_item ?? 10}
      />
    </div>
  );
}
