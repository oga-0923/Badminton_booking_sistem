// Supabase スキーマの手動型定義。
// スキーマ変更後は `supabase gen types typescript` で再生成することを推奨。

export type UserRole = "student" | "staff" | "admin";
export type ReservationStatus = "pending_payment" | "confirmed" | "cancelled" | "expired";
export type EquipmentType = "racket" | "shuttle";
export type LoanStatus = "borrowed" | "returned";

// Database ジェネリクスの制約 (GenericTable の Row/Insert/Update は Record<string, unknown>
// を満たす必要があるが、`interface` 宣言には暗黙のインデックスシグネチャが付与されず
// 制約を満たせないため、ここでは `type` エイリアスを使用する。
export type Profile = {
  id: string;
  email: string;
  full_name: string;
  student_id: string | null;
  phone: string | null;
  role: UserRole;
  stripe_customer_id: string | null;
  is_fee_exempt: boolean;
  created_at: string;
  updated_at: string;
};

export type StudentRoster = {
  id: string;
  student_id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
};

export type Court = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type VenueSettings = {
  id: number;
  open_time: string;
  close_time: string;
  slot_duration_minutes: number;
  booking_window_days: number;
  cancellation_deadline_days_before: number;
  cancellation_deadline_time: string;
  price_per_slot: number;
  pending_payment_timeout_minutes: number;
  rental_fee_per_item: number;
  updated_at: string;
};

export type Reservation = {
  id: string;
  court_id: string;
  user_id: string;
  reservation_date: string;
  start_time: string;
  end_time: string;
  status: ReservationStatus;
  hold_expires_at: string | null;
  stripe_payment_intent_id: string | null;
  amount: number;
  paid: boolean;
  checked_in_at: string | null;
  cancelled_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Equipment = {
  id: string;
  type: EquipmentType;
  name: string;
  total_quantity: number;
  created_at: string;
  updated_at: string;
};

export type EquipmentLoan = {
  id: string;
  equipment_id: string;
  reservation_id: string | null;
  user_id: string;
  quantity: number;
  status: LoanStatus;
  has_student_id: boolean;
  fee_amount: number;
  fee_collected: boolean;
  borrowed_at: string;
  due_at: string | null;
  returned_at: string | null;
};

export type CourtClosure = {
  id: string;
  court_id: string;
  closed_date: string;
  reason: string | null;
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, "id" | "email" | "full_name">;
        Update: Partial<Profile>;
        Relationships: [];
      };
      courts: {
        Row: Court;
        Insert: Partial<Court> & Pick<Court, "name">;
        Update: Partial<Court>;
        Relationships: [];
      };
      venue_settings: {
        Row: VenueSettings;
        Insert: Partial<VenueSettings>;
        Update: Partial<VenueSettings>;
        Relationships: [];
      };
      reservations: {
        Row: Reservation;
        Insert: Partial<Reservation> &
          Pick<Reservation, "court_id" | "user_id" | "reservation_date" | "start_time" | "end_time">;
        Update: Partial<Reservation>;
        Relationships: [
          {
            foreignKeyName: "reservations_court_id_fkey";
            columns: ["court_id"];
            isOneToOne: false;
            referencedRelation: "courts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      equipment: {
        Row: Equipment;
        Insert: Partial<Equipment> & Pick<Equipment, "type" | "name">;
        Update: Partial<Equipment>;
        Relationships: [];
      };
      equipment_loans: {
        Row: EquipmentLoan;
        Insert: Partial<EquipmentLoan> &
          Pick<EquipmentLoan, "equipment_id" | "user_id">;
        Update: Partial<EquipmentLoan>;
        Relationships: [
          {
            foreignKeyName: "equipment_loans_equipment_id_fkey";
            columns: ["equipment_id"];
            isOneToOne: false;
            referencedRelation: "equipment";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "equipment_loans_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "equipment_loans_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      court_closures: {
        Row: CourtClosure;
        Insert: Partial<CourtClosure> & Pick<CourtClosure, "court_id" | "closed_date">;
        Update: Partial<CourtClosure>;
        Relationships: [
          {
            foreignKeyName: "court_closures_court_id_fkey";
            columns: ["court_id"];
            isOneToOne: false;
            referencedRelation: "courts";
            referencedColumns: ["id"];
          },
        ];
      };
      student_roster: {
        Row: StudentRoster;
        Insert: Partial<StudentRoster> & Pick<StudentRoster, "student_id">;
        Update: Partial<StudentRoster>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_availability: {
        Args: { p_date: string };
        Returns: {
          court_id: string;
          start_time: string;
          end_time: string;
          status: ReservationStatus;
          is_own: boolean;
        }[];
      };
      expire_stale_reservations: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      is_court_closed: {
        Args: { p_court_id: string; p_date: string };
        Returns: boolean;
      };
      is_verified_student: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      check_student_id: {
        Args: { p_student_id: string };
        Returns: boolean;
      };
      get_checkin_info: {
        Args: { p_reservation_id: string };
        Returns: {
          id: string;
          court_name: string;
          reservation_date: string;
          start_time: string;
          end_time: string;
          status: ReservationStatus;
          full_name: string;
          student_id: string | null;
          checked_in_at: string | null;
          rentals: { type: EquipmentType; quantity: number }[];
        }[];
      };
    };
    Enums: {
      user_role: UserRole;
      reservation_status: ReservationStatus;
      equipment_type: EquipmentType;
      loan_status: LoanStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
