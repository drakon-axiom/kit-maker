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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          default_terms: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_terms?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_terms?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          external_ref: string | null
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          recorded_at: string
          recorded_by: string
        }
        Insert: {
          amount: number
          created_at?: string
          external_ref?: string | null
          id?: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          recorded_at?: string
          recorded_by: string
        }
        Update: {
          amount?: number
          created_at?: string
          external_ref?: string | null
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          recorded_at?: string
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          id: string
          invoice_no: string
          issued_at: string
          paid_at: string | null
          so_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax: number
          total: number
          type: Database["public"]["Enums"]["invoice_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_no: string
          issued_at?: string
          paid_at?: string | null
          so_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax?: number
          total: number
          type: Database["public"]["Enums"]["invoice_type"]
        }
        Update: {
          created_at?: string
          id?: string
          invoice_no?: string
          issued_at?: string
          paid_at?: string | null
          so_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          total?: number
          type?: Database["public"]["Enums"]["invoice_type"]
        }
        Relationships: [
          {
            foreignKeyName: "invoices_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batch_items: {
        Row: {
          batch_id: string
          bottle_qty_allocated: number
          created_at: string
          id: string
          so_line_id: string
        }
        Insert: {
          batch_id: string
          bottle_qty_allocated: number
          created_at?: string
          id?: string
          so_line_id: string
        }
        Update: {
          batch_id?: string
          bottle_qty_allocated?: number
          created_at?: string
          id?: string
          so_line_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batch_items_so_line_id_fkey"
            columns: ["so_line_id"]
            isOneToOne: false
            referencedRelation: "sales_order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batches: {
        Row: {
          actual_finish: string | null
          actual_start: string | null
          created_at: string
          human_uid: string
          id: string
          notes: string | null
          planned_start: string | null
          priority_index: number
          qty_bottle_good: number | null
          qty_bottle_planned: number
          qty_bottle_scrap: number | null
          so_id: string
          status: Database["public"]["Enums"]["batch_status"]
          uid: string
          updated_at: string
        }
        Insert: {
          actual_finish?: string | null
          actual_start?: string | null
          created_at?: string
          human_uid: string
          id?: string
          notes?: string | null
          planned_start?: string | null
          priority_index?: number
          qty_bottle_good?: number | null
          qty_bottle_planned: number
          qty_bottle_scrap?: number | null
          so_id: string
          status?: Database["public"]["Enums"]["batch_status"]
          uid: string
          updated_at?: string
        }
        Update: {
          actual_finish?: string | null
          actual_start?: string | null
          created_at?: string
          human_uid?: string
          id?: string
          notes?: string | null
          planned_start?: string | null
          priority_index?: number
          qty_bottle_good?: number | null
          qty_bottle_planned?: number
          qty_bottle_scrap?: number | null
          so_id?: string
          status?: Database["public"]["Enums"]["batch_status"]
          uid?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_batches_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_order_lines: {
        Row: {
          bottle_qty: number
          created_at: string
          id: string
          line_subtotal: number
          qty_entered: number
          sell_mode: Database["public"]["Enums"]["sell_mode"]
          sku_id: string
          so_id: string
          unit_price: number
        }
        Insert: {
          bottle_qty: number
          created_at?: string
          id?: string
          line_subtotal: number
          qty_entered: number
          sell_mode: Database["public"]["Enums"]["sell_mode"]
          sku_id: string
          so_id: string
          unit_price: number
        }
        Update: {
          bottle_qty?: number
          created_at?: string
          id?: string
          line_subtotal?: number
          qty_entered?: number
          sell_mode?: Database["public"]["Enums"]["sell_mode"]
          sku_id?: string
          so_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_lines_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          created_at: string
          customer_id: string
          deposit_amount: number | null
          deposit_required: boolean
          deposit_status: Database["public"]["Enums"]["deposit_status"]
          eta_date: string | null
          human_uid: string
          id: string
          label_required: boolean
          manual_payment_notes: string | null
          promised_date: string | null
          source_channel: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          uid: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          deposit_amount?: number | null
          deposit_required?: boolean
          deposit_status?: Database["public"]["Enums"]["deposit_status"]
          eta_date?: string | null
          human_uid: string
          id?: string
          label_required?: boolean
          manual_payment_notes?: string | null
          promised_date?: string | null
          source_channel?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          uid: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          deposit_amount?: number | null
          deposit_required?: boolean
          deposit_status?: Database["public"]["Enums"]["deposit_status"]
          eta_date?: string | null
          human_uid?: string
          id?: string
          label_required?: boolean
          manual_payment_notes?: string | null
          promised_date?: string | null
          source_channel?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          uid?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      shipments: {
        Row: {
          carrier: string | null
          created_at: string
          id: string
          label_url: string | null
          notes: string | null
          share_link_token: string
          shipped_at: string | null
          so_id: string
          tracking_no: string
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          id?: string
          label_url?: string | null
          notes?: string | null
          share_link_token?: string
          shipped_at?: string | null
          so_id: string
          tracking_no: string
        }
        Update: {
          carrier?: string | null
          created_at?: string
          id?: string
          label_url?: string | null
          notes?: string | null
          share_link_token?: string
          shipped_at?: string | null
          so_id?: string
          tracking_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sku_pricing_tiers: {
        Row: {
          created_at: string
          id: string
          max_quantity: number | null
          min_quantity: number
          price_per_kit: number
          sku_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_quantity?: number | null
          min_quantity: number
          price_per_kit: number
          sku_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_quantity?: number | null
          min_quantity?: number
          price_per_kit?: number
          sku_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sku_pricing_tiers_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      skus: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string
          id: string
          label_required: boolean
          price_per_kit: number
          price_per_piece: number
          updated_at: string
          use_tier_pricing: boolean
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description: string
          id?: string
          label_required?: boolean
          price_per_kit: number
          price_per_piece: number
          updated_at?: string
          use_tier_pricing?: boolean
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string
          id?: string
          label_required?: boolean
          price_per_kit?: number
          price_per_piece?: number
          updated_at?: string
          use_tier_pricing?: boolean
        }
        Relationships: []
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
      workflow_steps: {
        Row: {
          batch_id: string
          created_at: string
          finished_at: string | null
          id: string
          notes: string | null
          operator_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["step_status"]
          step: Database["public"]["Enums"]["workflow_step_type"]
        }
        Insert: {
          batch_id: string
          created_at?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          operator_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["step_status"]
          step: Database["public"]["Enums"]["workflow_step_type"]
        }
        Update: {
          batch_id?: string
          created_at?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          operator_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["step_status"]
          step?: Database["public"]["Enums"]["workflow_step_type"]
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated_user: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "operator"
      batch_status: "queued" | "wip" | "hold" | "complete"
      deposit_status: "unpaid" | "partial" | "paid"
      invoice_status: "unpaid" | "paid"
      invoice_type: "deposit" | "final"
      order_status:
        | "draft"
        | "quoted"
        | "deposit_due"
        | "in_queue"
        | "in_production"
        | "packed"
        | "invoiced"
        | "payment_due"
        | "ready_to_ship"
        | "shipped"
        | "cancelled"
        | "on_hold_customer"
        | "on_hold_internal"
        | "on_hold_materials"
        | "in_labeling"
        | "in_packing"
      payment_method: "cash" | "check" | "ach" | "wire" | "other"
      sell_mode: "kit" | "piece"
      step_status: "pending" | "wip" | "done"
      workflow_step_type: "produce" | "bottle_cap" | "label" | "pack"
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
      app_role: ["admin", "operator"],
      batch_status: ["queued", "wip", "hold", "complete"],
      deposit_status: ["unpaid", "partial", "paid"],
      invoice_status: ["unpaid", "paid"],
      invoice_type: ["deposit", "final"],
      order_status: [
        "draft",
        "quoted",
        "deposit_due",
        "in_queue",
        "in_production",
        "packed",
        "invoiced",
        "payment_due",
        "ready_to_ship",
        "shipped",
        "cancelled",
        "on_hold_customer",
        "on_hold_internal",
        "on_hold_materials",
        "in_labeling",
        "in_packing",
      ],
      payment_method: ["cash", "check", "ach", "wire", "other"],
      sell_mode: ["kit", "piece"],
      step_status: ["pending", "wip", "done"],
      workflow_step_type: ["produce", "bottle_cap", "label", "pack"],
    },
  },
} as const
