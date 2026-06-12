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
      publication_assets: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: string
          label: string | null
          notes: string | null
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
      publication_events: {
        Row: {
          actor: string | null
          created_at: string
          event_type: string
          id: string
          payload: Json
          slug: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          slug: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          event_type?: string
          id?: string
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
      publication_metadata: {
        Row: {
          categories: string[]
          contributors: string[]
          description: string
          isbn: string | null
          keywords: string[]
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
      publication_vera_config: {
        Row: {
          config: Json
          default_voice: string | null
          enabled_kinds: string[]
          slug: string
          updated_at: string
        }
        Insert: {
          config?: Json
          default_voice?: string | null
          enabled_kinds?: string[]
          slug: string
          updated_at?: string
        }
        Update: {
          config?: Json
          default_voice?: string | null
          enabled_kinds?: string[]
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
          slug: string
          status: Database["public"]["Enums"]["publication_status"]
          version: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          slug: string
          status: Database["public"]["Enums"]["publication_status"]
          version: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
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
