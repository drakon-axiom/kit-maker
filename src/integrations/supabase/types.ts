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
      box_presets: {
        Row: {
          active: boolean
          created_at: string
          height_inches: number
          id: string
          is_default: boolean
          length_inches: number
          name: string
          updated_at: string
          weight_oz: number | null
          width_inches: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          height_inches: number
          id?: string
          is_default?: boolean
          length_inches: number
          name: string
          updated_at?: string
          weight_oz?: number | null
          width_inches: number
        }
        Update: {
          active?: boolean
          created_at?: string
          height_inches?: number
          id?: string
          is_default?: boolean
          length_inches?: number
          name?: string
          updated_at?: string
          weight_oz?: number | null
          width_inches?: number
        }
        Relationships: []
      }
      brands: {
        Row: {
          accent_color: string
          accent_foreground: string
          active: boolean | null
          background_color: string
          btcpay_api_key: string | null
          btcpay_server_url: string | null
          btcpay_store_id: string | null
          card_color: string
          cashapp_tag: string | null
          contact_address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          domain: string | null
          foreground_color: string
          id: string
          is_default: boolean | null
          logo_url: string | null
          muted_color: string
          name: string
          paypal_checkout_enabled: boolean | null
          paypal_client_id: string | null
          paypal_client_secret: string | null
          paypal_email: string | null
          primary_color: string
          primary_foreground: string
          secondary_color: string
          secondary_foreground: string
          slug: string
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number | null
          smtp_user: string | null
          stripe_enabled: boolean | null
          updated_at: string | null
          wire_account_number: string | null
          wire_bank_name: string | null
          wire_routing_number: string | null
        }
        Insert: {
          accent_color?: string
          accent_foreground?: string
          active?: boolean | null
          background_color?: string
          btcpay_api_key?: string | null
          btcpay_server_url?: string | null
          btcpay_store_id?: string | null
          card_color?: string
          cashapp_tag?: string | null
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          domain?: string | null
          foreground_color?: string
          id?: string
          is_default?: boolean | null
          logo_url?: string | null
          muted_color?: string
          name: string
          paypal_checkout_enabled?: boolean | null
          paypal_client_id?: string | null
          paypal_client_secret?: string | null
          paypal_email?: string | null
          primary_color?: string
          primary_foreground?: string
          secondary_color?: string
          secondary_foreground?: string
          slug: string
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          stripe_enabled?: boolean | null
          updated_at?: string | null
          wire_account_number?: string | null
          wire_bank_name?: string | null
          wire_routing_number?: string | null
        }
        Update: {
          accent_color?: string
          accent_foreground?: string
          active?: boolean | null
          background_color?: string
          btcpay_api_key?: string | null
          btcpay_server_url?: string | null
          btcpay_store_id?: string | null
          card_color?: string
          cashapp_tag?: string | null
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          domain?: string | null
          foreground_color?: string
          id?: string
          is_default?: boolean | null
          logo_url?: string | null
          muted_color?: string
          name?: string
          paypal_checkout_enabled?: boolean | null
          paypal_client_id?: string | null
          paypal_client_secret?: string | null
          paypal_email?: string | null
          primary_color?: string
          primary_foreground?: string
          secondary_color?: string
          secondary_foreground?: string
          slug?: string
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          stripe_enabled?: boolean | null
          updated_at?: string | null
          wire_account_number?: string | null
          wire_bank_name?: string | null
          wire_routing_number?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_access_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          customer_id: string
          id: string
          requested_at: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          customer_id: string
          id?: string
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          requested_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_access_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_category_access: {
        Row: {
          category_id: string
          created_at: string
          customer_id: string
          id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          customer_id: string
          id?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          customer_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_category_access_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_category_access_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_product_access: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          sku_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          sku_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          sku_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_product_access_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_product_access_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_country: string | null
          billing_same_as_shipping: boolean | null
          billing_state: string | null
          billing_zip: string | null
          brand_id: string | null
          created_at: string
          default_terms: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          quote_expiration_days: number | null
          shipping_address_line1: string | null
          shipping_address_line2: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_state: string | null
          shipping_zip: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_same_as_shipping?: boolean | null
          billing_state?: string | null
          billing_zip?: string | null
          brand_id?: string | null
          created_at?: string
          default_terms?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          quote_expiration_days?: number | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_state?: string | null
          shipping_zip?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_same_as_shipping?: boolean | null
          billing_state?: string | null
          billing_zip?: string | null
          brand_id?: string | null
          created_at?: string
          default_terms?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          quote_expiration_days?: number | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_state?: string | null
          shipping_zip?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          available_variables: string[]
          brand_id: string | null
          created_at: string
          custom_html: string | null
          description: string | null
          id: string
          name: string
          subject: string
          template_type: string
          updated_at: string
        }
        Insert: {
          available_variables?: string[]
          brand_id?: string | null
          created_at?: string
          custom_html?: string | null
          description?: string | null
          id?: string
          name: string
          subject: string
          template_type: string
          updated_at?: string
        }
        Update: {
          available_variables?: string[]
          brand_id?: string | null
          created_at?: string
          custom_html?: string | null
          description?: string | null
          id?: string
          name?: string
          subject?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "public_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      label_settings: {
        Row: {
          created_at: string
          custom_html: string | null
          id: string
          label_type: string
          logo_position: string
          logo_url: string | null
          show_batch_quantity: boolean
          show_carrier: boolean
          show_customer_email: boolean
          show_customer_phone: boolean
          show_date: boolean
          show_logo: boolean
          show_order_reference: boolean
          show_qr_code: boolean
          show_status: boolean
          show_total_bottles: boolean
          show_tracking_number: boolean
          size_height: number
          size_width: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_html?: string | null
          id?: string
          label_type: string
          logo_position?: string
          logo_url?: string | null
          show_batch_quantity?: boolean
          show_carrier?: boolean
          show_customer_email?: boolean
          show_customer_phone?: boolean
          show_date?: boolean
          show_logo?: boolean
          show_order_reference?: boolean
          show_qr_code?: boolean
          show_status?: boolean
          show_total_bottles?: boolean
          show_tracking_number?: boolean
          size_height?: number
          size_width?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_html?: string | null
          id?: string
          label_type?: string
          logo_position?: string
          logo_url?: string | null
          show_batch_quantity?: boolean
          show_carrier?: boolean
          show_customer_email?: boolean
          show_customer_phone?: boolean
          show_date?: boolean
          show_logo?: boolean
          show_order_reference?: boolean
          show_qr_code?: boolean
          show_status?: boolean
          show_total_bottles?: boolean
          show_tracking_number?: boolean
          size_height?: number
          size_width?: number
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          customer_id: string
          email_marketing: boolean
          email_order_status: boolean
          email_payment_received: boolean
          email_quote_approved: boolean
          email_quote_expiring: boolean
          email_shipment_updates: boolean
          id: string
          sms_enabled: boolean
          sms_order_status: boolean
          sms_payment_received: boolean
          sms_phone_number: string | null
          sms_quote_approved: boolean
          sms_shipment_updates: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          email_marketing?: boolean
          email_order_status?: boolean
          email_payment_received?: boolean
          email_quote_approved?: boolean
          email_quote_expiring?: boolean
          email_shipment_updates?: boolean
          id?: string
          sms_enabled?: boolean
          sms_order_status?: boolean
          sms_payment_received?: boolean
          sms_phone_number?: string | null
          sms_quote_approved?: boolean
          sms_shipment_updates?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          email_marketing?: boolean
          email_order_status?: boolean
          email_payment_received?: boolean
          email_quote_approved?: boolean
          email_quote_expiring?: boolean
          email_shipment_updates?: boolean
          id?: string
          sms_enabled?: boolean
          sms_order_status?: boolean
          sms_payment_received?: boolean
          sms_phone_number?: string | null
          sms_quote_approved?: boolean
          sms_shipment_updates?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_addons: {
        Row: {
          addon_so_id: string
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          parent_so_id: string
          reason: string | null
          status: string
        }
        Insert: {
          addon_so_id: string
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          parent_so_id: string
          reason?: string | null
          status?: string
        }
        Update: {
          addon_so_id?: string
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          parent_so_id?: string
          reason?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_addons_addon_so_id_fkey"
            columns: ["addon_so_id"]
            isOneToOne: true
            referencedRelation: "public_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_addons_addon_so_id_fkey"
            columns: ["addon_so_id"]
            isOneToOne: true
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_addons_parent_so_id_fkey"
            columns: ["parent_so_id"]
            isOneToOne: false
            referencedRelation: "public_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_addons_parent_so_id_fkey"
            columns: ["parent_so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_comments: {
        Row: {
          admin_response: string | null
          comment: string
          comment_type: string | null
          created_at: string
          id: string
          is_internal: boolean
          modification_details: Json | null
          request_status: string | null
          resolved_at: string | null
          resolved_by: string | null
          so_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          comment: string
          comment_type?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          modification_details?: Json | null
          request_status?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          so_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          comment?: string
          comment_type?: string | null
          created_at?: string
          id?: string
          is_internal?: boolean
          modification_details?: Json | null
          request_status?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          so_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_comments_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "public_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_comments_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_packages: {
        Row: {
          created_at: string
          height_inches: number
          id: string
          item_count: number
          length_inches: number
          notes: string | null
          package_number: number
          so_id: string
          updated_at: string
          weight_oz: number
          width_inches: number
        }
        Insert: {
          created_at?: string
          height_inches?: number
          id?: string
          item_count?: number
          length_inches?: number
          notes?: string | null
          package_number?: number
          so_id: string
          updated_at?: string
          weight_oz?: number
          width_inches?: number
        }
        Update: {
          created_at?: string
          height_inches?: number
          id?: string
          item_count?: number
          length_inches?: number
          notes?: string | null
          package_number?: number
          so_id?: string
          updated_at?: string
          weight_oz?: number
          width_inches?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_packages_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "public_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_packages_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          customer_email: string
          id: string
          metadata: Json | null
          payment_method: string
          payment_type: string
          so_id: string
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_email: string
          id?: string
          metadata?: Json | null
          payment_method?: string
          payment_type: string
          so_id: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_email?: string
          id?: string
          metadata?: Json | null
          payment_method?: string
          payment_type?: string
          so_id?: string
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "public_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_so_id_fkey"
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
            referencedRelation: "public_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_photos: {
        Row: {
          batch_id: string | null
          caption: string | null
          file_size_bytes: number | null
          id: string
          photo_url: string
          so_id: string | null
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          batch_id?: string | null
          caption?: string | null
          file_size_bytes?: number | null
          id?: string
          photo_url: string
          so_id?: string | null
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          batch_id?: string | null
          caption?: string | null
          file_size_bytes?: number | null
          id?: string
          photo_url?: string
          so_id?: string | null
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_photos_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_photos_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "public_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_photos_so_id_fkey"
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
      quote_actions: {
        Row: {
          action: string
          action_by: string
          created_at: string
          id: string
          notes: string | null
          so_id: string
        }
        Insert: {
          action: string
          action_by: string
          created_at?: string
          id?: string
          notes?: string | null
          so_id: string
        }
        Update: {
          action?: string
          action_by?: string
          created_at?: string
          id?: string
          notes?: string | null
          so_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_actions_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "public_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_actions_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "public_quotes"
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
          archived: boolean
          archived_at: string | null
          brand_id: string | null
          consolidated_total: number | null
          created_at: string
          customer_id: string | null
          deposit_amount: number | null
          deposit_required: boolean
          deposit_status: Database["public"]["Enums"]["deposit_status"]
          eta_date: string | null
          hold_reason: string | null
          human_uid: string
          id: string
          is_internal: boolean
          label_required: boolean
          manual_payment_notes: string | null
          notes: string | null
          parent_order_id: string | null
          promised_date: string | null
          quote_expiration_days: number | null
          quote_expires_at: string | null
          quote_link_token: string
          source_channel: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          uid: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          brand_id?: string | null
          consolidated_total?: number | null
          created_at?: string
          customer_id?: string | null
          deposit_amount?: number | null
          deposit_required?: boolean
          deposit_status?: Database["public"]["Enums"]["deposit_status"]
          eta_date?: string | null
          hold_reason?: string | null
          human_uid: string
          id?: string
          is_internal?: boolean
          label_required?: boolean
          manual_payment_notes?: string | null
          notes?: string | null
          parent_order_id?: string | null
          promised_date?: string | null
          quote_expiration_days?: number | null
          quote_expires_at?: string | null
          quote_link_token?: string
          source_channel?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          uid: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          brand_id?: string | null
          consolidated_total?: number | null
          created_at?: string
          customer_id?: string | null
          deposit_amount?: number | null
          deposit_required?: boolean
          deposit_status?: Database["public"]["Enums"]["deposit_status"]
          eta_date?: string | null
          hold_reason?: string | null
          human_uid?: string
          id?: string
          is_internal?: boolean
          label_required?: boolean
          manual_payment_notes?: string | null
          notes?: string | null
          parent_order_id?: string | null
          promised_date?: string | null
          quote_expiration_days?: number | null
          quote_expires_at?: string | null
          quote_link_token?: string
          source_channel?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          uid?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_parent_order_id_fkey"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "public_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_parent_order_id_fkey"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          address_type: string
          city: string
          country: string
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          label: string
          state: string
          updated_at: string
          zip: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          address_type: string
          city: string
          country?: string
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean
          label: string
          state: string
          updated_at?: string
          zip: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          address_type?: string
          city?: string
          country?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          label?: string
          state?: string
          updated_at?: string
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_addresses_customer_id_fkey"
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
          estimated_delivery: string | null
          id: string
          label_url: string | null
          last_tracking_update: string | null
          notes: string | null
          share_link_token: string
          shipped_at: string | null
          shipstation_order_id: string | null
          shipstation_shipment_id: string | null
          so_id: string
          tracking_events: Json | null
          tracking_location: string | null
          tracking_no: string
          tracking_status: string | null
          voided_at: string | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          estimated_delivery?: string | null
          id?: string
          label_url?: string | null
          last_tracking_update?: string | null
          notes?: string | null
          share_link_token?: string
          shipped_at?: string | null
          shipstation_order_id?: string | null
          shipstation_shipment_id?: string | null
          so_id: string
          tracking_events?: Json | null
          tracking_location?: string | null
          tracking_no: string
          tracking_status?: string | null
          voided_at?: string | null
        }
        Update: {
          carrier?: string | null
          created_at?: string
          estimated_delivery?: string | null
          id?: string
          label_url?: string | null
          last_tracking_update?: string | null
          notes?: string | null
          share_link_token?: string
          shipped_at?: string | null
          shipstation_order_id?: string | null
          shipstation_shipment_id?: string | null
          so_id?: string
          tracking_events?: Json | null
          tracking_location?: string | null
          tracking_no?: string
          tracking_status?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "public_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sku_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          sku_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          sku_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          sku_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sku_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_categories_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
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
      sku_sizes: {
        Row: {
          created_at: string
          id: string
          size_ml: number
          sku_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          size_ml: number
          sku_id: string
        }
        Update: {
          created_at?: string
          id?: string
          size_ml?: number
          sku_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sku_sizes_sku_id_fkey"
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
          batch_prefix: string | null
          bundle_inserts_price: number | null
          bundle_labeling_price: number | null
          bundle_labor_price: number | null
          bundle_overhead_price: number | null
          bundle_packaging_price: number | null
          bundle_product_price: number | null
          category_id: string | null
          code: string
          created_at: string
          default_bottle_size_ml: number | null
          description: string
          id: string
          inserts_optional: boolean | null
          is_bundle: boolean
          label_required: boolean
          pack_size: number | null
          price_per_kit: number
          price_per_piece: number
          updated_at: string
          use_tier_pricing: boolean
        }
        Insert: {
          active?: boolean
          batch_prefix?: string | null
          bundle_inserts_price?: number | null
          bundle_labeling_price?: number | null
          bundle_labor_price?: number | null
          bundle_overhead_price?: number | null
          bundle_packaging_price?: number | null
          bundle_product_price?: number | null
          category_id?: string | null
          code: string
          created_at?: string
          default_bottle_size_ml?: number | null
          description: string
          id?: string
          inserts_optional?: boolean | null
          is_bundle?: boolean
          label_required?: boolean
          pack_size?: number | null
          price_per_kit: number
          price_per_piece: number
          updated_at?: string
          use_tier_pricing?: boolean
        }
        Update: {
          active?: boolean
          batch_prefix?: string | null
          bundle_inserts_price?: number | null
          bundle_labeling_price?: number | null
          bundle_labor_price?: number | null
          bundle_overhead_price?: number | null
          bundle_packaging_price?: number | null
          bundle_product_price?: number | null
          category_id?: string | null
          code?: string
          created_at?: string
          default_bottle_size_ml?: number | null
          description?: string
          id?: string
          inserts_optional?: boolean | null
          is_bundle?: boolean
          label_required?: boolean
          pack_size?: number | null
          price_per_kit?: number
          price_per_piece?: number
          updated_at?: string
          use_tier_pricing?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "skus_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          message: string
          phone_number: string
          sent_by: string | null
          so_id: string | null
          status: string
          template_type: string | null
          textbelt_response: Json | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          message: string
          phone_number: string
          sent_by?: string | null
          so_id?: string | null
          status?: string
          template_type?: string | null
          textbelt_response?: Json | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          message?: string
          phone_number?: string
          sent_by?: string | null
          so_id?: string | null
          status?: string
          template_type?: string | null
          textbelt_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "public_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_so_id_fkey"
            columns: ["so_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          available_variables: string[]
          created_at: string
          id: string
          message_template: string
          name: string
          template_type: string
          updated_at: string
        }
        Insert: {
          available_variables?: string[]
          created_at?: string
          id?: string
          message_template: string
          name: string
          template_type: string
          updated_at?: string
        }
        Update: {
          available_variables?: string[]
          created_at?: string
          id?: string
          message_template?: string
          name?: string
          template_type?: string
          updated_at?: string
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
      wholesale_applications: {
        Row: {
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_country: string | null
          billing_same_as_shipping: boolean | null
          billing_state: string | null
          billing_zip: string | null
          business_type: string | null
          company_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          message: string | null
          notes: string | null
          phone: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shipping_address_line1: string | null
          shipping_address_line2: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_state: string | null
          shipping_zip: string | null
          status: Database["public"]["Enums"]["application_status"]
          website: string | null
        }
        Insert: {
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_same_as_shipping?: boolean | null
          billing_state?: string | null
          billing_zip?: string | null
          business_type?: string | null
          company_name: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          message?: string | null
          notes?: string | null
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_state?: string | null
          shipping_zip?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          website?: string | null
        }
        Update: {
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_same_as_shipping?: boolean | null
          billing_state?: string | null
          billing_zip?: string | null
          business_type?: string | null
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          notes?: string | null
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_state?: string | null
          shipping_zip?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          website?: string | null
        }
        Relationships: []
      }
      wholesale_applications_archive: {
        Row: {
          archived_at: string
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_country: string | null
          billing_same_as_shipping: boolean | null
          billing_state: string | null
          billing_zip: string | null
          business_type: string | null
          company_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          message: string | null
          notes: string | null
          phone: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shipping_address_line1: string | null
          shipping_address_line2: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_state: string | null
          shipping_zip: string | null
          status: Database["public"]["Enums"]["application_status"]
          website: string | null
        }
        Insert: {
          archived_at?: string
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_same_as_shipping?: boolean | null
          billing_state?: string | null
          billing_zip?: string | null
          business_type?: string | null
          company_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          message?: string | null
          notes?: string | null
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_state?: string | null
          shipping_zip?: string | null
          status: Database["public"]["Enums"]["application_status"]
          website?: string | null
        }
        Update: {
          archived_at?: string
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_same_as_shipping?: boolean | null
          billing_state?: string | null
          billing_zip?: string | null
          business_type?: string | null
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          notes?: string | null
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_state?: string | null
          shipping_zip?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          website?: string | null
        }
        Relationships: []
      }
      workflow_completions: {
        Row: {
          batch_id: string
          completed_at: string
          created_at: string
          elapsed_seconds: number
          id: string
          labor_cost: number
          labor_rate_per_hour: number
          notes: string | null
          operator_id: string
          started_at: string
          steps_completed: number
        }
        Insert: {
          batch_id: string
          completed_at: string
          created_at?: string
          elapsed_seconds: number
          id?: string
          labor_cost: number
          labor_rate_per_hour: number
          notes?: string | null
          operator_id: string
          started_at: string
          steps_completed?: number
        }
        Update: {
          batch_id?: string
          completed_at?: string
          created_at?: string
          elapsed_seconds?: number
          id?: string
          labor_cost?: number
          labor_rate_per_hour?: number
          notes?: string | null
          operator_id?: string
          started_at?: string
          steps_completed?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_completions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "production_batches"
            referencedColumns: ["id"]
          },
        ]
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
      public_quotes: {
        Row: {
          created_at: string | null
          customer_name: string | null
          deposit_amount: number | null
          deposit_required: boolean | null
          human_uid: string | null
          id: string | null
          quote_expires_at: string | null
          quote_link_token: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          subtotal: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_batch_number: { Args: { sku_code: string }; Returns: string }
      generate_order_number: { Args: { order_prefix: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated_user: { Args: never; Returns: boolean }
      is_customer: { Args: never; Returns: boolean }
      validate_order_status_transition: {
        Args: {
          _new_status: Database["public"]["Enums"]["order_status"]
          _order_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "operator" | "customer"
      application_status: "pending" | "approved" | "rejected"
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
        | "awaiting_invoice"
        | "awaiting_payment"
        | "awaiting_approval"
        | "ready_to_stock"
        | "on_hold"
        | "stocked"
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
      app_role: ["admin", "operator", "customer"],
      application_status: ["pending", "approved", "rejected"],
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
        "awaiting_invoice",
        "awaiting_payment",
        "awaiting_approval",
        "ready_to_stock",
        "on_hold",
        "stocked",
      ],
      payment_method: ["cash", "check", "ach", "wire", "other"],
      sell_mode: ["kit", "piece"],
      step_status: ["pending", "wip", "done"],
      workflow_step_type: ["produce", "bottle_cap", "label", "pack"],
    },
  },
} as const
