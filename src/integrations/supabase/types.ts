export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      publication_artifacts: {
        Row: {
          byte_size: number
          filename: string
          generated_at: string
          generated_by: string | null
          id: string
          is_active: boolean
          kind: string
          media_type: string
          owner_id: string | null
          slug: string
          source_queue_id: string | null
          status: Database["public"]["Enums"]["artifact_status"]
          storage_bucket: string
          storage_path: string
          superseded_at: string | null
          target: string | null
          validation: Json
          version: number
        }
        Insert: {
          byte_size?: number
          filename: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          is_active?: boolean
          kind: string
          media_type: string
          owner_id?: string | null
          slug: string
          source_queue_id?: string | null
          status?: Database["public"]["Enums"]["artifact_status"]
          storage_bucket?: string
          storage_path: string
          superseded_at?: string | null
          target?: string | null
          validation?: Json
          version?: number
        }
        Update: {
          byte_size?: number
          filename?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          media_type?: string
          owner_id?: string | null
          slug?: string
          source_queue_id?: string | null
          status?: Database["public"]["Enums"]["artifact_status"]
          storage_bucket?: string
          storage_path?: string
          superseded_at?: string | null
          target?: string | null
          validation?: Json
          version?: number
        }
        Relationships: []
      }
      publication_assets: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: string
          label: string | null
          notes: string | null
          owner_id: string | null
          replaces_id: string | null
          slug: string
          uploaded_at: string
          url: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
          label?: string | null
          notes?: string | null
          owner_id?: string | null
          replaces_id?: string | null
          slug: string
          uploaded_at?: string
          url: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          label?: string | null
          notes?: string | null
          owner_id?: string | null
          replaces_id?: string | null
          slug?: string
          uploaded_at?: string
          url?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "publication_assets_replaces_id_fkey"
            columns: ["replaces_id"]
            isOneToOne: false
            referencedRelation: "publication_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_assets_slug_fkey"
            columns: ["slug"]
            isOneToOne: false
            referencedRelation: "publication_records"
            referencedColumns: ["slug"]
          },
        ]
      }
      publication_distribution_queue: {
        Row: {
          artifact_url: string | null
          blockers: Json
          created_at: string
          id: string
          notes: string | null
          owner_id: string | null
          payload: Json
          slug: string
          state: Database["public"]["Enums"]["distribution_queue_state"]
          submitted_at: string | null
          target: string
          updated_at: string
        }
        Insert: {
          artifact_url?: string | null
          blockers?: Json
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          payload?: Json
          slug: string
          state?: Database["public"]["Enums"]["distribution_queue_state"]
          submitted_at?: string | null
          target: string
          updated_at?: string
        }
        Update: {
          artifact_url?: string | null
          blockers?: Json
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          payload?: Json
          slug?: string
          state?: Database["public"]["Enums"]["distribution_queue_state"]
          submitted_at?: string | null
          target?: string
          updated_at?: string
        }
        Relationships: []
      }
      publication_events: {
        Row: {
          actor: string | null
          created_at: string
          event_type: string
          id: string
          owner_id: string | null
          payload: Json
          slug: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          event_type: string
          id?: string
          owner_id?: string | null
          payload?: Json
          slug: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          event_type?: string
          id?: string
          owner_id?: string | null
          payload?: Json
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_events_slug_fkey"
            columns: ["slug"]
            isOneToOne: false
            referencedRelation: "publication_records"
            referencedColumns: ["slug"]
          },
        ]
      }
      publication_isbns: {
        Row: {
          assigned_at: string
          edition: string
          format: string
          id: string
          isbn: string
          notes: string | null
          owner_id: string | null
          slug: string
          status: string
        }
        Insert: {
          assigned_at?: string
          edition?: string
          format: string
          id?: string
          isbn: string
          notes?: string | null
          owner_id?: string | null
          slug: string
          status?: string
        }
        Update: {
          assigned_at?: string
          edition?: string
          format?: string
          id?: string
          isbn?: string
          notes?: string | null
          owner_id?: string | null
          slug?: string
          status?: string
        }
        Relationships: []
      }
      publication_metadata: {
        Row: {
          categories: string[]
          contributors: string[]
          description: string
          isbn: string | null
          keywords: string[]
          owner_id: string | null
          publisher: string
          reading_level: string | null
          rights: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          categories?: string[]
          contributors?: string[]
          description?: string
          isbn?: string | null
          keywords?: string[]
          owner_id?: string | null
          publisher?: string
          reading_level?: string | null
          rights?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          categories?: string[]
          contributors?: string[]
          description?: string
          isbn?: string | null
          keywords?: string[]
          owner_id?: string | null
          publisher?: string
          reading_level?: string | null
          rights?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_metadata_slug_fkey"
            columns: ["slug"]
            isOneToOne: true
            referencedRelation: "publication_records"
            referencedColumns: ["slug"]
          },
        ]
      }
      publication_records: {
        Row: {
          audience: string | null
          author: string
          created_at: string
          language: string
          last_updated: string
          owner_id: string | null
          profile: string
          publication_date: string | null
          series: string | null
          slug: string
          status: Database["public"]["Enums"]["publication_status"]
          subtitle: string | null
          title: string
          version: string
          volume: number | null
        }
        Insert: {
          audience?: string | null
          author: string
          created_at?: string
          language?: string
          last_updated?: string
          owner_id?: string | null
          profile?: string
          publication_date?: string | null
          series?: string | null
          slug: string
          status?: Database["public"]["Enums"]["publication_status"]
          subtitle?: string | null
          title: string
          version?: string
          volume?: number | null
        }
        Update: {
          audience?: string | null
          author?: string
          created_at?: string
          language?: string
          last_updated?: string
          owner_id?: string | null
          profile?: string
          publication_date?: string | null
          series?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["publication_status"]
          subtitle?: string | null
          title?: string
          version?: string
          volume?: number | null
        }
        Relationships: []
      }
      publication_sources: {
        Row: {
          bib_path: string | null
          format: string
          owner_id: string | null
          slug: string
          storage_path: string
          uploaded_at: string
          vera_path: string | null
        }
        Insert: {
          bib_path?: string | null
          format: string
          owner_id?: string | null
          slug: string
          storage_path: string
          uploaded_at?: string
          vera_path?: string | null
        }
        Update: {
          bib_path?: string | null
          format?: string
          owner_id?: string | null
          slug?: string
          storage_path?: string
          uploaded_at?: string
          vera_path?: string | null
        }
        Relationships: []
      }
      publication_submissions: {
        Row: {
          created_at: string
          id: string
          isbn: string | null
          notes: string | null
          owner_id: string | null
          platform: string
          queue_id: string | null
          response_payload: Json
          slug: string
          status: string
          submitted_at: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          isbn?: string | null
          notes?: string | null
          owner_id?: string | null
          platform: string
          queue_id?: string | null
          response_payload?: Json
          slug: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          isbn?: string | null
          notes?: string | null
          owner_id?: string | null
          platform?: string
          queue_id?: string | null
          response_payload?: Json
          slug?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "publication_submissions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "publication_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      publication_vendors: {
        Row: {
          account_id: string | null
          created_at: string
          credential_ref: string | null
          enabled: boolean
          id: string
          label: string
          platform: string
          settings: Json
          submission_prefs: Json
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          credential_ref?: string | null
          enabled?: boolean
          id?: string
          label: string
          platform: string
          settings?: Json
          submission_prefs?: Json
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          credential_ref?: string | null
          enabled?: boolean
          id?: string
          label?: string
          platform?: string
          settings?: Json
          submission_prefs?: Json
          updated_at?: string
        }
        Relationships: []
      }
      publication_vera_config: {
        Row: {
          config: Json
          default_voice: string | null
          enabled_kinds: string[]
          owner_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          config?: Json
          default_voice?: string | null
          enabled_kinds?: string[]
          owner_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          config?: Json
          default_voice?: string | null
          enabled_kinds?: string[]
          owner_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_vera_config_slug_fkey"
            columns: ["slug"]
            isOneToOne: true
            referencedRelation: "publication_records"
            referencedColumns: ["slug"]
          },
        ]
      }
      publication_versions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          owner_id: string | null
          slug: string
          status: Database["public"]["Enums"]["publication_status"]
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          slug: string
          status: Database["public"]["Enums"]["publication_status"]
          version: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["publication_status"]
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_versions_slug_fkey"
            columns: ["slug"]
            isOneToOne: false
            referencedRelation: "publication_records"
            referencedColumns: ["slug"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "ceo" | "admin" | "editor" | "reader"
      artifact_status:
        | "pending"
        | "generated"
        | "validated"
        | "failed"
        | "superseded"
      distribution_queue_state:
        | "queued"
        | "processing"
        | "blocked"
        | "ready"
        | "submitted"
        | "failed"
      publication_status:
        | "draft"
        | "editing"
        | "review"
        | "formatting"
        | "ready"
        | "published"
        | "archived"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["ceo", "admin", "editor", "reader"],
      artifact_status: [
        "pending",
        "generated",
        "validated",
        "failed",
        "superseded",
      ],
      distribution_queue_state: [
        "queued",
        "processing",
        "blocked",
        "ready",
        "submitted",
        "failed",
      ],
      publication_status: [
        "draft",
        "editing",
        "review",
        "formatting",
        "ready",
        "published",
        "archived",
      ],
    },
  },
} as const
