export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      ai_usage: {
        Row: {
          cost_usd: number;
          created_at: string;
          duration_ms: number | null;
          error_code: string | null;
          feature: string;
          id: number;
          input_tokens: number;
          model: string;
          output_tokens: number;
          status: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          cost_usd?: number;
          created_at?: string;
          duration_ms?: number | null;
          error_code?: string | null;
          feature: string;
          id?: never;
          input_tokens?: number;
          model: string;
          output_tokens?: number;
          status: string;
          user_id?: string | null;
        };
        Update: {
          cost_usd?: number;
          created_at?: string;
          duration_ms?: number | null;
          error_code?: string | null;
          feature?: string;
          id?: never;
          input_tokens?: number;
          model?: string;
          output_tokens?: number;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      chat_threads: {
        Row: {
          created_at: string;
          id: string;
          subject_id: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          subject_id: string;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          subject_id?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_threads_subject_id_user_id_fkey";
            columns: ["subject_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      chunks: {
        Row: {
          content: string;
          created_at: string;
          embedding: string;
          id: string;
          material_id: string;
          page: number | null;
          position: number;
          section: string | null;
          start_seconds: number | null;
          subject_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          content: string;
          created_at?: string;
          embedding: string;
          id?: string;
          material_id: string;
          page?: number | null;
          position: number;
          section?: string | null;
          start_seconds?: number | null;
          subject_id: string;
          user_id?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          embedding?: string;
          id?: string;
          material_id?: string;
          page?: number | null;
          position?: number;
          section?: string | null;
          start_seconds?: number | null;
          subject_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chunks_material_id_subject_id_user_id_fkey";
            columns: ["material_id", "subject_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id", "subject_id", "user_id"];
          },
        ];
      };
      event_units: {
        Row: {
          event_id: string;
          unit_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          event_id: string;
          unit_id: string;
          user_id?: string;
        };
        Update: {
          event_id?: string;
          unit_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_units_event_id_user_id_fkey";
            columns: ["event_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "event_units_unit_id_user_id_fkey";
            columns: ["unit_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      events: {
        Row: {
          created_at: string;
          event_date: string | null;
          event_time: string | null;
          id: string;
          kind: string;
          notes: string | null;
          subject_id: string;
          title: string;
          updated_at: string;
          user_id: string;
          weight: number | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          event_date?: string | null;
          event_time?: string | null;
          id?: string;
          kind?: string;
          notes?: string | null;
          subject_id: string;
          title: string;
          updated_at?: string;
          user_id?: string;
          weight?: number | null;
        };
        Update: {
          created_at?: string;
          event_date?: string | null;
          event_time?: string | null;
          id?: string;
          kind?: string;
          notes?: string | null;
          subject_id?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
          weight?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "events_subject_id_user_id_fkey";
            columns: ["subject_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      materials: {
        Row: {
          created_at: string;
          duration_seconds: number | null;
          error: string | null;
          files: NonNullable<Json>;
          id: string;
          is_syllabus: boolean;
          kind: string;
          locked_until: string | null;
          processed_units: number;
          source_url: string | null;
          status: string;
          storage_bucket: string;
          subject_id: string;
          title: string;
          topic_id: string | null;
          topic_source: string;
          total_units: number | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          duration_seconds?: number | null;
          error?: string | null;
          files?: NonNullable<Json>;
          id?: string;
          is_syllabus?: boolean;
          kind: string;
          locked_until?: string | null;
          processed_units?: number;
          source_url?: string | null;
          status?: string;
          storage_bucket?: string;
          subject_id: string;
          title: string;
          topic_id?: string | null;
          topic_source?: string;
          total_units?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          duration_seconds?: number | null;
          error?: string | null;
          files?: NonNullable<Json>;
          id?: string;
          is_syllabus?: boolean;
          kind?: string;
          locked_until?: string | null;
          processed_units?: number;
          source_url?: string | null;
          status?: string;
          storage_bucket?: string;
          subject_id?: string;
          title?: string;
          topic_id?: string | null;
          topic_source?: string;
          total_units?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "materials_subject_id_user_id_fkey";
            columns: ["subject_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "materials_topic_id_user_id_fkey";
            columns: ["topic_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      messages: {
        Row: {
          citations: NonNullable<Json>;
          content: string;
          created_at: string;
          id: string;
          mode: string | null;
          role: string;
          thread_id: string;
          used_general_knowledge: boolean;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          citations?: NonNullable<Json>;
          content: string;
          created_at?: string;
          id?: string;
          mode?: string | null;
          role: string;
          thread_id: string;
          used_general_knowledge?: boolean;
          user_id?: string;
        };
        Update: {
          citations?: NonNullable<Json>;
          content?: string;
          created_at?: string;
          id?: string;
          mode?: string | null;
          role?: string;
          thread_id?: string;
          used_general_knowledge?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_user_id_fkey";
            columns: ["thread_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "chat_threads";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          onboarding_completed_at: string | null;
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          onboarding_completed_at?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          onboarding_completed_at?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      signup_allowlist: {
        Row: {
          created_at: string;
          note: string | null;
          pattern: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          note?: string | null;
          pattern: string;
        };
        Update: {
          created_at?: string;
          note?: string | null;
          pattern?: string;
        };
        Relationships: [];
      };
      subjects: {
        Row: {
          bibliography: NonNullable<Json>;
          color: string;
          created_at: string;
          icon: string;
          id: string;
          name: string;
          teacher_email: string | null;
          teacher_name: string | null;
          teacher_notes: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          bibliography?: NonNullable<Json>;
          color?: string;
          created_at?: string;
          icon?: string;
          id?: string;
          name: string;
          teacher_email?: string | null;
          teacher_name?: string | null;
          teacher_notes?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          bibliography?: NonNullable<Json>;
          color?: string;
          created_at?: string;
          icon?: string;
          id?: string;
          name?: string;
          teacher_email?: string | null;
          teacher_name?: string | null;
          teacher_notes?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      syllabus_imports: {
        Row: {
          applied_at: string | null;
          created_at: string;
          error: string | null;
          extraction: Json | null;
          files: NonNullable<Json>;
          id: string;
          status: string;
          subject_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          applied_at?: string | null;
          created_at?: string;
          error?: string | null;
          extraction?: Json | null;
          files?: NonNullable<Json>;
          id?: string;
          status?: string;
          subject_id: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          applied_at?: string | null;
          created_at?: string;
          error?: string | null;
          extraction?: Json | null;
          files?: NonNullable<Json>;
          id?: string;
          status?: string;
          subject_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "syllabus_imports_subject_id_user_id_fkey";
            columns: ["subject_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      topics: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          position: number;
          title: string;
          unit_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          position?: number;
          title: string;
          unit_id: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          position?: number;
          title?: string;
          unit_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "topics_unit_id_user_id_fkey";
            columns: ["unit_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      units: {
        Row: {
          created_at: string;
          id: string;
          position: number;
          subject_id: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          position?: number;
          subject_id: string;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          position?: number;
          subject_id?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "units_subject_id_user_id_fkey";
            columns: ["subject_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      ai_spend_since: { Args: { p_since: string }; Returns: number };
      apply_syllabus_import: { Args: { p_import_id: string; p_payload: Json }; Returns: Json };
      clear_subject: { Args: { p_subject_id: string }; Returns: undefined };
      is_signup_allowed: { Args: { p_email: string }; Returns: boolean };
      match_chunks: {
        Args: { p_match_count?: number; p_query_embedding: string; p_subject_id: string };
        Returns: {
          chunk_id: string;
          content: string;
          material_id: string;
          material_kind: string;
          material_title: string;
          page: number;
          section: string;
          similarity: number;
          source_url: string;
          start_seconds: number;
        }[];
      };
      my_ai_usage_summary: {
        Args: { p_since: string };
        Returns: {
          calls: number;
          cost_usd: number;
          feature: string;
          input_tokens: number;
          model: string;
          output_tokens: number;
        }[];
      };
      reorder_topics: { Args: { p_topic_ids: string[]; p_unit_id: string }; Returns: undefined };
      reorder_units: { Args: { p_subject_id: string; p_unit_ids: string[] }; Returns: undefined };
      save_material_batch: {
        Args: {
          p_chunks: Json;
          p_done: boolean;
          p_from_units: number;
          p_material_id: string;
          p_to_units: number;
          p_total_units: number;
        };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
