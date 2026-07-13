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
      app_settings: {
        Row: {
          id: string
          key: string
          org_id: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          org_id: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          org_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          org_id: string
          store_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          org_id: string
          store_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          org_id?: string
          store_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cashier_sessions: {
        Row: {
          actual_cash: number | null
          cashier_id: string
          close_reason: string | null
          closed_at: string | null
          closed_by: string | null
          device_id: string
          expected_cash: number | null
          force_closed: boolean
          id: string
          notes: string | null
          opened_at: string
          opening_cash: number
          status: Database["public"]["Enums"]["session_status"]
          store_id: string
          variance: number | null
        }
        Insert: {
          actual_cash?: number | null
          cashier_id: string
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          device_id: string
          expected_cash?: number | null
          force_closed?: boolean
          id?: string
          notes?: string | null
          opened_at?: string
          opening_cash?: number
          status?: Database["public"]["Enums"]["session_status"]
          store_id: string
          variance?: number | null
        }
        Update: {
          actual_cash?: number | null
          cashier_id?: string
          close_reason?: string | null
          closed_at?: string | null
          closed_by?: string | null
          device_id?: string
          expected_cash?: number | null
          force_closed?: boolean
          id?: string
          notes?: string | null
          opened_at?: string
          opening_cash?: number
          status?: Database["public"]["Enums"]["session_status"]
          store_id?: string
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cashier_sessions_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashier_sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashier_sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashier_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cashier_vault_ledger: {
        Row: {
          amount: number
          balance_after: number
          cashier_id: string
          created_at: string
          created_by: string
          entry_type: Database["public"]["Enums"]["cashier_vault_entry_type"]
          id: string
          notes: string
          org_id: string
          session_id: string | null
          store_id: string
          vault_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          cashier_id: string
          created_at?: string
          created_by: string
          entry_type: Database["public"]["Enums"]["cashier_vault_entry_type"]
          id?: string
          notes?: string
          org_id: string
          session_id?: string | null
          store_id: string
          vault_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          cashier_id?: string
          created_at?: string
          created_by?: string
          entry_type?: Database["public"]["Enums"]["cashier_vault_entry_type"]
          id?: string
          notes?: string
          org_id?: string
          session_id?: string | null
          store_id?: string
          vault_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashier_vault_ledger_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashier_vault_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashier_vault_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashier_vault_ledger_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cashier_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashier_vault_ledger_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashier_vault_ledger_vault_id_fkey"
            columns: ["vault_id"]
            isOneToOne: false
            referencedRelation: "cashier_vaults"
            referencedColumns: ["id"]
          },
        ]
      }
      cashier_vaults: {
        Row: {
          balance: number
          cashier_id: string
          created_at: string
          id: string
          org_id: string
          pending_opening_float: number
          store_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          cashier_id: string
          created_at?: string
          id?: string
          org_id: string
          pending_opening_float?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          cashier_id?: string
          created_at?: string
          id?: string
          org_id?: string
          pending_opening_float?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashier_vaults_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashier_vaults_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashier_vaults_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string
          icon: string
          id: string
          name: string
          org_id: string
          sort_order: number
        }
        Insert: {
          color?: string
          icon?: string
          id?: string
          name: string
          org_id: string
          sort_order?: number
        }
        Update: {
          color?: string
          icon?: string
          id?: string
          name?: string
          org_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          store_id: string | null
          type: Database["public"]["Enums"]["cost_center_type"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          store_id?: string | null
          type?: Database["public"]["Enums"]["cost_center_type"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          store_id?: string | null
          type?: Database["public"]["Enums"]["cost_center_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_centers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_ledger: {
        Row: {
          created_at: string
          created_by: string
          credit: number
          customer_id: string
          debit: number
          entry_type: Database["public"]["Enums"]["customer_ledger_entry_type"]
          id: string
          notes: string
          order_id: string | null
          org_id: string
          payment_id: string | null
          reference: string
          store_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          credit?: number
          customer_id: string
          debit?: number
          entry_type: Database["public"]["Enums"]["customer_ledger_entry_type"]
          id?: string
          notes?: string
          order_id?: string | null
          org_id: string
          payment_id?: string | null
          reference?: string
          store_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          credit?: number
          customer_id?: string
          debit?: number
          entry_type?: Database["public"]["Enums"]["customer_ledger_entry_type"]
          id?: string
          notes?: string
          order_id?: string | null
          org_id?: string
          payment_id?: string | null
          reference?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ledger_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ledger_payment_fk"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "customer_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ledger_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          customer_id: string
          id: string
          notes: string
          org_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          received_at: string
          reference: string
          store_id: string
          voided_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          customer_id: string
          id?: string
          notes?: string
          org_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          received_at?: string
          reference?: string
          store_id: string
          voided_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          customer_id?: string
          id?: string
          notes?: string
          org_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          received_at?: string
          reference?: string
          store_id?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          account_balance: number
          created_at: string
          credit_limit: number
          email: string | null
          id: string
          name: string
          notes: string
          org_id: string
          payment_terms: string
          phone: string
          total_spent: number
          visit_count: number
        }
        Insert: {
          account_balance?: number
          created_at?: string
          credit_limit?: number
          email?: string | null
          id?: string
          name: string
          notes?: string
          org_id: string
          payment_terms?: string
          phone: string
          total_spent?: number
          visit_count?: number
        }
        Update: {
          account_balance?: number
          created_at?: string
          credit_limit?: number
          email?: string | null
          id?: string
          name?: string
          notes?: string
          org_id?: string
          payment_terms?: string
          phone?: string
          total_spent?: number
          visit_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      device_pairing_attempts: {
        Row: {
          attempted_at: string
          id: string
          org_id: string | null
          success: boolean
        }
        Insert: {
          attempted_at?: string
          id?: string
          org_id?: string | null
          success?: boolean
        }
        Update: {
          attempted_at?: string
          id?: string
          org_id?: string | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "device_pairing_attempts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      device_pairing_codes: {
        Row: {
          code_hash: string
          created_at: string
          created_by: string
          device_id: string
          expires_at: string
          id: string
          org_id: string
          used_at: string | null
        }
        Insert: {
          code_hash: string
          created_at?: string
          created_by: string
          device_id: string
          expires_at: string
          id?: string
          org_id: string
          used_at?: string | null
        }
        Update: {
          code_hash?: string
          created_at?: string
          created_by?: string
          device_id?: string
          expires_at?: string
          id?: string
          org_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_pairing_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_pairing_codes_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_pairing_codes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          device_key_hash: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          name: string
          store_id: string
        }
        Insert: {
          device_key_hash: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          name: string
          store_id: string
        }
        Update: {
          device_key_hash?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          name?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          cost_center_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          requires_inventory_item: boolean
          updated_at: string
        }
        Insert: {
          cost_center_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          requires_inventory_item?: boolean
          updated_at?: string
        }
        Update: {
          cost_center_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          requires_inventory_item?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          cost_center_id: string
          created_at: string
          created_by: string
          expense_category_id: string
          expense_source: Database["public"]["Enums"]["expense_source"]
          id: string
          inventory_item_id: string | null
          notes: string
          payment_method: Database["public"]["Enums"]["expense_payment_method"]
          quantity: number | null
          receipt_url: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["expense_status"]
          store_id: string
          supplier_id: string | null
          title: string
          unit_cost: number | null
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          cost_center_id: string
          created_at?: string
          created_by: string
          expense_category_id: string
          expense_source: Database["public"]["Enums"]["expense_source"]
          id?: string
          inventory_item_id?: string | null
          notes?: string
          payment_method: Database["public"]["Enums"]["expense_payment_method"]
          quantity?: number | null
          receipt_url?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          store_id: string
          supplier_id?: string | null
          title?: string
          unit_cost?: number | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          cost_center_id?: string
          created_at?: string
          created_by?: string
          expense_category_id?: string
          expense_source?: Database["public"]["Enums"]["expense_source"]
          id?: string
          inventory_item_id?: string | null
          notes?: string
          payment_method?: Database["public"]["Enums"]["expense_payment_method"]
          quantity?: number | null
          receipt_url?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          store_id?: string
          supplier_id?: string | null
          title?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_expense_category_id_fkey"
            columns: ["expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cashier_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          created_at: string
          created_by: string
          file_url: string | null
          id: string
          org_id: string
          result: Json
          status: Database["public"]["Enums"]["import_job_status"]
          type: string
        }
        Insert: {
          created_at?: string
          created_by: string
          file_url?: string | null
          id?: string
          org_id: string
          result?: Json
          status?: Database["public"]["Enums"]["import_job_status"]
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string
          file_url?: string | null
          id?: string
          org_id?: string
          result?: Json
          status?: Database["public"]["Enums"]["import_job_status"]
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_batch_movements: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          inventory_movement_id: string | null
          org_id: string
          quantity_delta: number
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          inventory_movement_id?: string | null
          org_id: string
          quantity_delta: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          inventory_movement_id?: string | null
          org_id?: string
          quantity_delta?: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batch_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batch_movements_inventory_movement_id_fkey"
            columns: ["inventory_movement_id"]
            isOneToOne: false
            referencedRelation: "inventory_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batch_movements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_batches: {
        Row: {
          batch_number: string
          created_at: string
          created_by: string | null
          expiry_date: string | null
          id: string
          is_expired: boolean
          notes: string | null
          org_id: string
          product_id: string
          production_date: string | null
          purchase_invoice_id: string | null
          quantity: number
          received_date: string
          remaining_quantity: number
          source_document_id: string | null
          source_type: Database["public"]["Enums"]["batch_source_type"]
          store_id: string
          supplier_id: string | null
          unit: Database["public"]["Enums"]["measurement_unit"]
          updated_at: string
          variant_id: string | null
          warehouse_id: string
        }
        Insert: {
          batch_number: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          is_expired?: boolean
          notes?: string | null
          org_id: string
          product_id: string
          production_date?: string | null
          purchase_invoice_id?: string | null
          quantity: number
          received_date?: string
          remaining_quantity: number
          source_document_id?: string | null
          source_type: Database["public"]["Enums"]["batch_source_type"]
          store_id: string
          supplier_id?: string | null
          unit?: Database["public"]["Enums"]["measurement_unit"]
          updated_at?: string
          variant_id?: string | null
          warehouse_id: string
        }
        Update: {
          batch_number?: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          is_expired?: boolean
          notes?: string | null
          org_id?: string
          product_id?: string
          production_date?: string | null
          purchase_invoice_id?: string | null
          quantity?: number
          received_date?: string
          remaining_quantity?: number
          source_document_id?: string | null
          source_type?: Database["public"]["Enums"]["batch_source_type"]
          store_id?: string
          supplier_id?: string | null
          unit?: Database["public"]["Enums"]["measurement_unit"]
          updated_at?: string
          variant_id?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          batch_id: string | null
          batch_number: string | null
          created_at: string
          created_by: string
          expiry_date: string | null
          id: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          product_id: string
          quantity_delta: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          serial_number: string | null
          store_id: string
          variant_id: string | null
          warehouse_id: string
        }
        Insert: {
          batch_id?: string | null
          batch_number?: string | null
          created_at?: string
          created_by: string
          expiry_date?: string | null
          id?: string
          movement_type: Database["public"]["Enums"]["movement_type"]
          product_id: string
          quantity_delta: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          serial_number?: string | null
          store_id: string
          variant_id?: string | null
          warehouse_id: string
        }
        Update: {
          batch_id?: string | null
          batch_number?: string | null
          created_at?: string
          created_by?: string
          expiry_date?: string | null
          id?: string
          movement_type?: Database["public"]["Enums"]["movement_type"]
          product_id?: string
          quantity_delta?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          serial_number?: string | null
          store_id?: string
          variant_id?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_units: {
        Row: {
          category: string
          code: string
          created_at: string
          id: string
          is_base: boolean
          is_system: boolean
          name: string
          org_id: string
        }
        Insert: {
          category?: string
          code: string
          created_at?: string
          id?: string
          is_base?: boolean
          is_system?: boolean
          name: string
          org_id: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          id?: string
          is_base?: boolean
          is_system?: boolean
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_units_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_ledger: {
        Row: {
          balance_after: number
          created_at: string
          customer_id: string
          id: string
          order_id: string | null
          points_delta: number
          reason: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          customer_id: string
          id?: string
          order_id?: string | null
          points_delta: number
          reason: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          customer_id?: string
          id?: string
          order_id?: string | null
          points_delta?: number
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rules: {
        Row: {
          id: string
          is_active: boolean
          minimum_redeem_points: number
          org_id: string
          points_per_currency: number
          redemption_rate: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          minimum_redeem_points?: number
          org_id: string
          points_per_currency?: number
          redemption_rate?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          minimum_redeem_points?: number
          org_id?: string
          points_per_currency?: number
          redemption_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      online_order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          online_order_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price: number
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          line_total: number
          online_order_id: string
          product_id: string
          product_name: string
          quantity: number
          unit_price: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          online_order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          unit_price?: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "online_order_items_online_order_id_fkey"
            columns: ["online_order_id"]
            isOneToOne: false
            referencedRelation: "online_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      online_orders: {
        Row: {
          created_at: string
          customer_name: string
          customer_phone: string | null
          discount: number
          id: string
          notes: string
          order_id: string | null
          status: Database["public"]["Enums"]["online_order_status"]
          store_id: string
          subtotal: number
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          discount?: number
          id?: string
          notes?: string
          order_id?: string | null
          status?: Database["public"]["Enums"]["online_order_status"]
          store_id: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          discount?: number
          id?: string
          notes?: string
          order_id?: string | null
          status?: Database["public"]["Enums"]["online_order_status"]
          store_id?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "online_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "online_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_deductions: {
        Row: {
          id: string
          ingredient_product_id: string
          line_cost: number
          order_item_id: string
          quantity: number
          unit: Database["public"]["Enums"]["measurement_unit"]
          unit_cost: number
        }
        Insert: {
          id?: string
          ingredient_product_id: string
          line_cost?: number
          order_item_id: string
          quantity: number
          unit: Database["public"]["Enums"]["measurement_unit"]
          unit_cost?: number
        }
        Update: {
          id?: string
          ingredient_product_id?: string
          line_cost?: number
          order_item_id?: string
          quantity?: number
          unit?: Database["public"]["Enums"]["measurement_unit"]
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_deductions_ingredient_product_id_fkey"
            columns: ["ingredient_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_deductions_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          base_quantity: number | null
          id: string
          line_cost: number
          line_note: string | null
          line_total: number
          modifiers: Json
          order_id: string
          product_id: string
          quantity: number
          sale_input_mode:
            | Database["public"]["Enums"]["weight_sale_input_mode"]
            | null
          sale_unit: Database["public"]["Enums"]["measurement_unit"] | null
          tier_id: string | null
          unit_cost: number
          unit_price: number
          variant_id: string | null
          wholesale_applied: boolean
        }
        Insert: {
          base_quantity?: number | null
          id?: string
          line_cost?: number
          line_note?: string | null
          line_total: number
          modifiers?: Json
          order_id: string
          product_id: string
          quantity: number
          sale_input_mode?:
            | Database["public"]["Enums"]["weight_sale_input_mode"]
            | null
          sale_unit?: Database["public"]["Enums"]["measurement_unit"] | null
          tier_id?: string | null
          unit_cost?: number
          unit_price: number
          variant_id?: string | null
          wholesale_applied?: boolean
        }
        Update: {
          base_quantity?: number | null
          id?: string
          line_cost?: number
          line_note?: string | null
          line_total?: number
          modifiers?: Json
          order_id?: string
          product_id?: string
          quantity?: number
          sale_input_mode?:
            | Database["public"]["Enums"]["weight_sale_input_mode"]
            | null
          sale_unit?: Database["public"]["Enums"]["measurement_unit"] | null
          tier_id?: string | null
          unit_cost?: number
          unit_price?: number
          variant_id?: string | null
          wholesale_applied?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          amount: number
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          reference: string | null
        }
        Insert: {
          amount: number
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          reference?: string | null
        }
        Update: {
          amount?: number
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          order_id?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          activity_type: Database["public"]["Enums"]["business_activity_type"]
          created_at: string
          created_by: string
          customer_id: string | null
          discount: number
          id: string
          order_number: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          sales_mode: Database["public"]["Enums"]["sales_mode"]
          session_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal: number
          tax: number
          total: number
        }
        Insert: {
          activity_type?: Database["public"]["Enums"]["business_activity_type"]
          created_at?: string
          created_by: string
          customer_id?: string | null
          discount?: number
          id?: string
          order_number: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          sales_mode?: Database["public"]["Enums"]["sales_mode"]
          session_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          subtotal?: number
          tax?: number
          total?: number
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["business_activity_type"]
          created_at?: string
          created_by?: string
          customer_id?: string | null
          discount?: number
          id?: string
          order_number?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          sales_mode?: Database["public"]["Enums"]["sales_mode"]
          session_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          subtotal?: number
          tax?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cashier_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          country: string
          created_at: string
          currency: string
          id: string
          logo_url: string | null
          name: string
          settings: Json
          status: string
          timezone: string
        }
        Insert: {
          country?: string
          created_at?: string
          currency?: string
          id?: string
          logo_url?: string | null
          name: string
          settings?: Json
          status?: string
          timezone?: string
        }
        Update: {
          country?: string
          created_at?: string
          currency?: string
          id?: string
          logo_url?: string | null
          name?: string
          settings?: Json
          status?: string
          timezone?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          description: string
          group_name: string
          key: string
          label: string
        }
        Insert: {
          description?: string
          group_name?: string
          key: string
          label: string
        }
        Update: {
          description?: string
          group_name?: string
          key?: string
          label?: string
        }
        Relationships: []
      }
      pin_attempts: {
        Row: {
          attempted_by: string | null
          created_at: string
          id: string
          org_id: string
          store_id: string
          success: boolean
        }
        Insert: {
          attempted_by?: string | null
          created_at?: string
          id?: string
          org_id: string
          store_id: string
          success?: boolean
        }
        Update: {
          attempted_by?: string | null
          created_at?: string
          id?: string
          org_id?: string
          store_id?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "pin_attempts_attempted_by_fkey"
            columns: ["attempted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pin_attempts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pin_attempts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      pin_codes: {
        Row: {
          id: string
          is_active: boolean
          pin_hash: string
          user_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          pin_hash: string
          user_id: string
        }
        Update: {
          id?: string
          is_active?: boolean
          pin_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pin_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          platform_admin_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          platform_admin_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          platform_admin_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_audit_logs_platform_admin_id_fkey"
            columns: ["platform_admin_id"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_company_invites: {
        Row: {
          accepted_at: string | null
          accepted_org_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          org_name: string
          owner_email: string
          owner_name: string
          revoked_at: string | null
          revoked_by: string | null
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_org_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          org_name: string
          owner_email: string
          owner_name?: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_org_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          org_name?: string
          owner_email?: string
          owner_name?: string
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_company_invites_accepted_org_id_fkey"
            columns: ["accepted_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_company_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_company_invites_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "platform_admins"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_held_carts: {
        Row: {
          created_at: string
          created_by: string
          device_id: string
          id: string
          name: string
          org_id: string
          payload: Json
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          device_id: string
          id?: string
          name: string
          org_id: string
          payload?: Json
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          device_id?: string
          id?: string
          name?: string
          org_id?: string
          payload?: Json
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_held_carts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_held_carts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_held_carts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_held_carts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_tiers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          min_quantity: number
          name: string
          org_id: string
          price: number
          product_id: string
          sale_mode: Database["public"]["Enums"]["sales_mode"]
          unit: Database["public"]["Enums"]["measurement_unit"]
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          min_quantity?: number
          name: string
          org_id: string
          price: number
          product_id: string
          sale_mode?: Database["public"]["Enums"]["sales_mode"]
          unit?: Database["public"]["Enums"]["measurement_unit"]
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          min_quantity?: number
          name?: string
          org_id?: string
          price?: number
          product_id?: string
          sale_mode?: Database["public"]["Enums"]["sales_mode"]
          unit?: Database["public"]["Enums"]["measurement_unit"]
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_price_tiers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_tiers_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_recipe_lines: {
        Row: {
          id: string
          ingredient_product_id: string
          quantity: number
          recipe_id: string
          sort_order: number
          unit: Database["public"]["Enums"]["measurement_unit"]
        }
        Insert: {
          id?: string
          ingredient_product_id: string
          quantity: number
          recipe_id: string
          sort_order?: number
          unit: Database["public"]["Enums"]["measurement_unit"]
        }
        Update: {
          id?: string
          ingredient_product_id?: string
          quantity?: number
          recipe_id?: string
          sort_order?: number
          unit?: Database["public"]["Enums"]["measurement_unit"]
        }
        Relationships: [
          {
            foreignKeyName: "product_recipe_lines_ingredient_product_id_fkey"
            columns: ["ingredient_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipe_lines_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "product_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      product_recipes: {
        Row: {
          created_at: string
          id: string
          org_id: string
          product_id: string
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          product_id: string
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          product_id?: string
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_recipes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipes_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_serial_numbers: {
        Row: {
          created_at: string
          id: string
          imei: string | null
          org_id: string
          product_id: string
          serial_number: string
          status: string
          variant_id: string | null
          warranty_expiry: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          imei?: string | null
          org_id: string
          product_id: string
          serial_number: string
          status?: string
          variant_id?: string | null
          warranty_expiry?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          imei?: string | null
          org_id?: string
          product_id?: string
          serial_number?: string
          status?: string
          variant_id?: string | null
          warranty_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_serial_numbers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_serial_numbers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_serial_numbers_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string
          fixed_price: number | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price: number | null
          price_delta: number
          price_mode: Database["public"]["Enums"]["variant_price_mode"] | null
          product_id: string
          quantity_unit: Database["public"]["Enums"]["measurement_unit"] | null
          quantity_value: number | null
          sku: string
          variant_kind: Database["public"]["Enums"]["variant_kind"]
        }
        Insert: {
          barcode?: string
          fixed_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price?: number | null
          price_delta?: number
          price_mode?: Database["public"]["Enums"]["variant_price_mode"] | null
          product_id: string
          quantity_unit?: Database["public"]["Enums"]["measurement_unit"] | null
          quantity_value?: number | null
          sku: string
          variant_kind?: Database["public"]["Enums"]["variant_kind"]
        }
        Update: {
          barcode?: string
          fixed_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price?: number | null
          price_delta?: number
          price_mode?: Database["public"]["Enums"]["variant_price_mode"] | null
          product_id?: string
          quantity_unit?: Database["public"]["Enums"]["measurement_unit"] | null
          quantity_value?: number | null
          sku?: string
          variant_kind?: Database["public"]["Enums"]["variant_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allow_fractional_quantity: boolean
          allow_price_input: boolean
          barcode: string
          base_price: number
          base_unit: Database["public"]["Enums"]["measurement_unit"]
          category_id: string | null
          cost_unit: Database["public"]["Enums"]["measurement_unit"]
          created_at: string
          description: string
          expiry_policy: Database["public"]["Enums"]["expiry_policy_type"]
          expiry_tracking_enabled: boolean
          id: string
          image_url: string | null
          inventory_product_type: Database["public"]["Enums"]["inventory_product_type"]
          inventory_rotation_method: Database["public"]["Enums"]["inventory_rotation_method"]
          inventory_tracking_mode: Database["public"]["Enums"]["inventory_tracking_mode"]
          is_active: boolean
          is_popular: boolean
          show_on_online_menu: boolean
          last_unit_cost: number
          name: string
          org_id: string
          product_type: Database["public"]["Enums"]["product_type"]
          sale_price: number | null
          sale_unit: Database["public"]["Enums"]["measurement_unit"]
          sales_unit_type: Database["public"]["Enums"]["product_sales_unit_type"]
          shelf_life_unit: Database["public"]["Enums"]["shelf_life_unit_type"]
          shelf_life_value: number
          sku: string
          supports_amount_sale: boolean
          supports_weight_sale: boolean
          track_inventory: boolean
          unit: Database["public"]["Enums"]["measurement_unit"]
          updated_at: string
          wholesale_enabled: boolean
        }
        Insert: {
          allow_fractional_quantity?: boolean
          allow_price_input?: boolean
          barcode?: string
          base_price?: number
          base_unit?: Database["public"]["Enums"]["measurement_unit"]
          category_id?: string | null
          cost_unit?: Database["public"]["Enums"]["measurement_unit"]
          created_at?: string
          description?: string
          expiry_policy?: Database["public"]["Enums"]["expiry_policy_type"]
          expiry_tracking_enabled?: boolean
          id?: string
          image_url?: string | null
          inventory_product_type?: Database["public"]["Enums"]["inventory_product_type"]
          inventory_rotation_method?: Database["public"]["Enums"]["inventory_rotation_method"]
          inventory_tracking_mode?: Database["public"]["Enums"]["inventory_tracking_mode"]
          is_active?: boolean
          is_popular?: boolean
          show_on_online_menu?: boolean
          last_unit_cost?: number
          name: string
          org_id: string
          product_type?: Database["public"]["Enums"]["product_type"]
          sale_price?: number | null
          sale_unit?: Database["public"]["Enums"]["measurement_unit"]
          sales_unit_type?: Database["public"]["Enums"]["product_sales_unit_type"]
          shelf_life_unit?: Database["public"]["Enums"]["shelf_life_unit_type"]
          shelf_life_value?: number
          sku: string
          supports_amount_sale?: boolean
          supports_weight_sale?: boolean
          track_inventory?: boolean
          unit?: Database["public"]["Enums"]["measurement_unit"]
          updated_at?: string
          wholesale_enabled?: boolean
        }
        Update: {
          allow_fractional_quantity?: boolean
          allow_price_input?: boolean
          barcode?: string
          base_price?: number
          base_unit?: Database["public"]["Enums"]["measurement_unit"]
          category_id?: string | null
          cost_unit?: Database["public"]["Enums"]["measurement_unit"]
          created_at?: string
          description?: string
          expiry_policy?: Database["public"]["Enums"]["expiry_policy_type"]
          expiry_tracking_enabled?: boolean
          id?: string
          image_url?: string | null
          inventory_product_type?: Database["public"]["Enums"]["inventory_product_type"]
          inventory_rotation_method?: Database["public"]["Enums"]["inventory_rotation_method"]
          inventory_tracking_mode?: Database["public"]["Enums"]["inventory_tracking_mode"]
          is_active?: boolean
          is_popular?: boolean
          show_on_online_menu?: boolean
          last_unit_cost?: number
          name?: string
          org_id?: string
          product_type?: Database["public"]["Enums"]["product_type"]
          sale_price?: number | null
          sale_unit?: Database["public"]["Enums"]["measurement_unit"]
          sales_unit_type?: Database["public"]["Enums"]["product_sales_unit_type"]
          shelf_life_unit?: Database["public"]["Enums"]["shelf_life_unit_type"]
          shelf_life_value?: number
          sku?: string
          supports_amount_sale?: boolean
          supports_weight_sale?: boolean
          track_inventory?: boolean
          unit?: Database["public"]["Enums"]["measurement_unit"]
          updated_at?: string
          wholesale_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoice_lines: {
        Row: {
          batch_number: string | null
          expiry_date: string | null
          id: string
          invoice_id: string
          landed_line_total: number | null
          landed_unit_cost: number | null
          line_total: number
          product_id: string
          production_date: string | null
          quantity: number
          unit_cost: number
          variant_id: string | null
        }
        Insert: {
          batch_number?: string | null
          expiry_date?: string | null
          id?: string
          invoice_id: string
          landed_line_total?: number | null
          landed_unit_cost?: number | null
          line_total: number
          product_id: string
          production_date?: string | null
          quantity: number
          unit_cost: number
          variant_id?: string | null
        }
        Update: {
          batch_number?: string | null
          expiry_date?: string | null
          id?: string
          invoice_id?: string
          landed_line_total?: number | null
          landed_unit_cost?: number | null
          line_total?: number
          product_id?: string
          production_date?: string | null
          quantity?: number
          unit_cost?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_lines_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          cancelled_at: string | null
          created_at: string
          created_by: string
          extra_cost: number
          id: string
          invoice_number: string
          received_at: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          store_id: string
          subtotal: number
          supplier_id: string
          tax: number
          total: number
          warehouse_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          created_by: string
          extra_cost?: number
          id?: string
          invoice_number: string
          received_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          store_id: string
          subtotal?: number
          supplier_id: string
          tax?: number
          total?: number
          warehouse_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          created_by?: string
          extra_cost?: number
          id?: string
          invoice_number?: string
          received_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          store_id?: string
          subtotal?: number
          supplier_id?: string
          tax?: number
          total?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          org_id: string
          permission_key: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          org_id: string
          permission_key: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          org_id?: string
          permission_key?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      stock_count_lines: {
        Row: {
          batch_id: string | null
          batch_number: string | null
          count_id: string
          counted_qty: number
          expected_qty: number
          expiry_date: string | null
          id: string
          product_id: string
          variance: number
          variant_id: string | null
        }
        Insert: {
          batch_id?: string | null
          batch_number?: string | null
          count_id: string
          counted_qty: number
          expected_qty: number
          expiry_date?: string | null
          id?: string
          product_id: string
          variance?: number
          variant_id?: string | null
        }
        Update: {
          batch_id?: string | null
          batch_number?: string | null
          count_id?: string
          counted_qty?: number
          expected_qty?: number
          expiry_date?: string | null
          id?: string
          product_id?: string
          variance?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_lines_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_lines_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "stock_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_lines_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_counts: {
        Row: {
          completed_at: string | null
          created_by: string
          id: string
          started_at: string
          status: Database["public"]["Enums"]["stock_count_status"]
          store_id: string
          warehouse_id: string
        }
        Insert: {
          completed_at?: string | null
          created_by: string
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["stock_count_status"]
          store_id: string
          warehouse_id: string
        }
        Update: {
          completed_at?: string | null
          created_by?: string
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["stock_count_status"]
          store_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_counts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_levels: {
        Row: {
          id: string
          product_id: string
          quantity: number
          reorder_point: number
          reserved_quantity: number
          store_id: string
          updated_at: string
          variant_id: string | null
          warehouse_id: string
        }
        Insert: {
          id?: string
          product_id: string
          quantity?: number
          reorder_point?: number
          reserved_quantity?: number
          store_id: string
          updated_at?: string
          variant_id?: string | null
          warehouse_id: string
        }
        Update: {
          id?: string
          product_id?: string
          quantity?: number
          reorder_point?: number
          reserved_quantity?: number
          store_id?: string
          updated_at?: string
          variant_id?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_levels_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_levels_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string
          code: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          phone: string
          settings: Json
          timezone: string | null
        }
        Insert: {
          address?: string
          code?: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          phone?: string
          settings?: Json
          timezone?: string | null
        }
        Update: {
          address?: string
          code?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          phone?: string
          settings?: Json
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          notes: string
          org_id: string
          paid_at: string
          payment_method: string
          reference: string
          store_id: string
          supplier_id: string
          voided_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          id?: string
          notes?: string
          org_id: string
          paid_at?: string
          payment_method: string
          reference?: string
          store_id: string
          supplier_id: string
          voided_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          notes?: string
          org_id?: string
          paid_at?: string
          payment_method?: string
          reference?: string
          store_id?: string
          supplier_id?: string
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_info: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          contact_info?: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          contact_info?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_order_lines: {
        Row: {
          batch_id: string | null
          batch_number: string | null
          id: string
          product_id: string
          quantity_received: number
          quantity_sent: number
          transfer_id: string
          variant_id: string | null
        }
        Insert: {
          batch_id?: string | null
          batch_number?: string | null
          id?: string
          product_id: string
          quantity_received?: number
          quantity_sent: number
          transfer_id: string
          variant_id?: string | null
        }
        Update: {
          batch_id?: string | null
          batch_number?: string | null
          id?: string
          product_id?: string
          quantity_received?: number
          quantity_sent?: number
          transfer_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transfer_order_lines_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_order_lines_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfer_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_order_lines_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_orders: {
        Row: {
          created_at: string
          created_by: string
          from_store_id: string
          from_warehouse_id: string
          id: string
          received_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["transfer_status"]
          to_store_id: string
          to_warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          from_store_id: string
          from_warehouse_id: string
          id?: string
          received_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_store_id: string
          to_warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          from_store_id?: string
          from_warehouse_id?: string
          id?: string
          received_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_store_id?: string
          to_warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_orders_from_store_id_fkey"
            columns: ["from_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_orders_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_orders_to_store_id_fkey"
            columns: ["to_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_orders_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_conversions: {
        Row: {
          created_at: string
          factor: number
          from_unit: Database["public"]["Enums"]["measurement_unit"]
          id: string
          org_id: string
          to_unit: Database["public"]["Enums"]["measurement_unit"]
        }
        Insert: {
          created_at?: string
          factor: number
          from_unit: Database["public"]["Enums"]["measurement_unit"]
          id?: string
          org_id: string
          to_unit: Database["public"]["Enums"]["measurement_unit"]
        }
        Update: {
          created_at?: string
          factor?: number
          from_unit?: Database["public"]["Enums"]["measurement_unit"]
          id?: string
          org_id?: string
          to_unit?: Database["public"]["Enums"]["measurement_unit"]
        }
        Relationships: [
          {
            foreignKeyName: "unit_conversions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_device_access: {
        Row: {
          device_id: string
          is_active: boolean
          user_id: string
        }
        Insert: {
          device_id: string
          is_active?: boolean
          user_id: string
        }
        Update: {
          device_id?: string
          is_active?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_device_access_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_device_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permission_grants: {
        Row: {
          granted: boolean
          permission_key: string
          user_id: string
        }
        Insert: {
          granted?: boolean
          permission_key: string
          user_id: string
        }
        Update: {
          granted?: boolean
          permission_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permission_grants_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "user_permission_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_store_access: {
        Row: {
          store_id: string
          user_id: string
        }
        Insert: {
          store_id: string
          user_id: string
        }
        Update: {
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_store_access_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_store_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          org_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          org_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          org_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_records: {
        Row: {
          batch_id: string | null
          batch_number: string | null
          created_at: string
          created_by: string
          expiry_date: string | null
          id: string
          notes: string
          product_id: string
          quantity: number
          reason_code: string
          store_id: string
          variant_id: string | null
          warehouse_id: string
        }
        Insert: {
          batch_id?: string | null
          batch_number?: string | null
          created_at?: string
          created_by: string
          expiry_date?: string | null
          id?: string
          notes?: string
          product_id: string
          quantity: number
          reason_code: string
          store_id: string
          variant_id?: string | null
          warehouse_id: string
        }
        Update: {
          batch_id?: string | null
          batch_number?: string | null
          created_at?: string
          created_by?: string
          expiry_date?: string | null
          id?: string
          notes?: string
          product_id?: string
          quantity?: number
          reason_code?: string
          store_id?: string
          variant_id?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waste_records_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "inventory_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_records_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_records_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_records_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_device_pairing_rate_limit: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      auth_app_user_id: { Args: never; Returns: string }
      auth_org_id: { Args: never; Returns: string }
      auth_user_id: { Args: never; Returns: string }
      auth_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      can_delete_expenses: { Args: never; Returns: boolean }
      can_edit_expenses: { Args: never; Returns: boolean }
      can_manage_recipes: { Args: never; Returns: boolean }
      can_mutate_expenses: { Args: never; Returns: boolean }
      can_mutate_inventory_ops: { Args: never; Returns: boolean }
      can_mutate_orders: { Args: never; Returns: boolean }
      can_view_costs: { Args: never; Returns: boolean }
      cashier_can_use_device: {
        Args: { p_device_id: string; p_store_id: string; p_user_id: string }
        Returns: boolean
      }
      cashier_vault_admin_withdraw: {
        Args: {
          p_cashier_id: string
          p_next_opening_float: number
          p_notes?: string
          p_store_id: string
          p_withdraw_amount: number
        }
        Returns: {
          balance: number
          cashier_id: string
          created_at: string
          id: string
          org_id: string
          pending_opening_float: number
          store_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cashier_vaults"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cashier_vault_deposit_closing: {
        Args: {
          p_amount: number
          p_cashier_id: string
          p_session_id: string
          p_store_id: string
        }
        Returns: {
          balance: number
          cashier_id: string
          created_at: string
          id: string
          org_id: string
          pending_opening_float: number
          store_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cashier_vaults"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cashier_vault_refund_opening_float: {
        Args: { p_amount: number; p_cashier_id: string; p_store_id: string }
        Returns: {
          balance: number
          cashier_id: string
          created_at: string
          id: string
          org_id: string
          pending_opening_float: number
          store_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cashier_vaults"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cashier_vault_take_opening_float: {
        Args: { p_amount: number; p_cashier_id: string; p_store_id: string }
        Returns: {
          balance: number
          cashier_id: string
          created_at: string
          id: string
          org_id: string
          pending_opening_float: number
          store_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cashier_vaults"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_checkout: {
        Args: {
          p_cashier_id: string
          p_customer_id: string
          p_device_id?: string
          p_discount: number
          p_lines: Json
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_sales_mode?: Database["public"]["Enums"]["sales_mode"]
          p_session_id: string
          p_store_id: string
        }
        Returns: Json
      }
      complete_checkout_expired_override: {
        Args: {
          p_cashier_id: string
          p_customer_id: string
          p_device_id?: string
          p_discount: number
          p_lines: Json
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_sales_mode?: Database["public"]["Enums"]["sales_mode"]
          p_session_id: string
          p_store_id: string
        }
        Returns: Json
      }
      complete_checkout_split: {
        Args: {
          p_cashier_id: string
          p_customer_id: string
          p_device_id?: string
          p_discount: number
          p_lines: Json
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_payments: Json
          p_sales_mode?: Database["public"]["Enums"]["sales_mode"]
          p_session_id: string
          p_store_id: string
        }
        Returns: Json
      }
      complete_checkout_split_expired_override: {
        Args: {
          p_cashier_id: string
          p_customer_id: string
          p_device_id?: string
          p_discount: number
          p_lines: Json
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_payments: Json
          p_sales_mode?: Database["public"]["Enums"]["sales_mode"]
          p_session_id: string
          p_store_id: string
        }
        Returns: Json
      }
      complete_unpaid_checkout: {
        Args: {
          p_cashier_id: string
          p_customer_id: string
          p_discount: number
          p_lines: Json
          p_session_id: string
          p_store_id: string
        }
        Returns: Json
      }
      compute_recipe_cost: { Args: { p_recipe_id: string }; Returns: number }
      consume_device_pairing_code: {
        Args: { p_code: string }
        Returns: {
          device_id: string
          store_id: string
        }[]
      }
      convert_unit: {
        Args: {
          p_from: Database["public"]["Enums"]["measurement_unit"]
          p_qty: number
          p_to: Database["public"]["Enums"]["measurement_unit"]
        }
        Returns: number
      }
      create_device_pairing_code: {
        Args: { p_device_id: string }
        Returns: string
      }
      deployment_has_organization: { Args: never; Returns: boolean }
      ensure_cashier_vault: {
        Args: { p_cashier_id: string; p_org_id: string; p_store_id: string }
        Returns: {
          balance: number
          cashier_id: string
          created_at: string
          id: string
          org_id: string
          pending_opening_float: number
          store_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cashier_vaults"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_permission: { Args: { p_key: string }; Returns: boolean }
      has_store_access: { Args: { p_store_id: string }; Returns: boolean }
      initialize_organization: {
        Args: {
          p_business_activity?: Json
          p_country: string
          p_currency: string
          p_default_tax_behavior?: string
          p_expense_settings?: Json
          p_feature_flags: Json
          p_logo_url: string
          p_org_name: string
          p_owner_email?: string
          p_payment_methods?: Json
          p_prevent_negative_stock?: boolean
          p_receipt_footer: string
          p_receipt_header: string
          p_seed_defaults?: Json
          p_session_settings?: Json
          p_store_address: string
          p_store_code: string
          p_store_name: string
          p_store_phone: string
          p_store_timezone: string
          p_tax_enabled: boolean
          p_tax_inclusive: boolean
          p_tax_rate: number
          p_timezone: string
        }
        Returns: Json
      }
      insert_audit_log: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_store_id?: string
        }
        Returns: string
      }
      is_feature_enabled: { Args: { p_flag: string }; Returns: boolean }
      is_period_closed: {
        Args: { p_at: string; p_store_id: string }
        Returns: boolean
      }
      is_privileged_role: { Args: never; Returns: boolean }
      platform_organization_data_size: {
        Args: { p_org_id: string }
        Returns: Json
      }
      record_customer_payment: {
        Args: {
          p_amount: number
          p_customer_id: string
          p_notes?: string
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_reference?: string
          p_store_id: string
        }
        Returns: string
      }
      record_device_pairing_attempt: {
        Args: { p_org_id: string; p_success: boolean }
        Returns: undefined
      }
      refund_order: {
        Args: { p_actor_id?: string; p_order_id: string }
        Returns: Json
      }
      report_expiry_batches: {
        Args: { p_status?: string; p_store_id?: string }
        Returns: {
          batch_id: string
          batch_number: string
          days_until_expiry: number
          expiry_date: string
          product_name: string
          remaining_quantity: number
        }[]
      }
      report_inventory_valuation: {
        Args: { p_store_id?: string }
        Returns: {
          product_id: string
          product_name: string
          quantity: number
          total_value: number
          unit_cost: number
        }[]
      }
      report_sales_by_day: {
        Args: { p_from?: string; p_store_id?: string; p_to?: string }
        Returns: {
          day: string
          order_count: number
          revenue: number
        }[]
      }
      report_sales_summary: {
        Args: {
          p_from?: string
          p_payment_method?: string
          p_store_id?: string
          p_to?: string
        }
        Returns: {
          avg_order_value: number
          order_count: number
          total_revenue: number
        }[]
      }
      report_session_reconciliation: {
        Args: { p_session_id: string }
        Returns: {
          card_sales: number
          cash_refunds: number
          cash_sales: number
          credit_sales: number
          customer_payments: number
          expected_cash: number
          expenses: number
          opening_cash: number
          wallet_sales: number
        }[]
      }
      require_feature: { Args: { p_flag: string }; Returns: undefined }
      reverse_order_stock_and_credit: {
        Args: {
          p_actor_id: string
          p_order_id: string
          p_reason: string
          p_reference_type: string
        }
        Returns: Json
      }
      resolve_product_recipe_id: {
        Args: { p_product_id: string; p_variant_id: string }
        Returns: string
      }
      resolve_product_unit_price: {
        Args: {
          p_auto_wholesale: boolean
          p_org_id: string
          p_product_id: string
          p_qty: number
          p_sale_unit: Database["public"]["Enums"]["measurement_unit"]
          p_sales_mode: Database["public"]["Enums"]["sales_mode"]
          p_variant_id: string
        }
        Returns: {
          tier_id: string
          unit_price: number
          wholesale_applied: boolean
        }[]
      }
      seed_org_defaults: {
        Args: { p_org_id: string; p_store_id: string }
        Returns: undefined
      }
      set_default_warehouse: {
        Args: { p_store_id: string; p_warehouse_id: string }
        Returns: undefined
      }
      set_user_pin: {
        Args: { p_pin: string; p_user_id: string }
        Returns: undefined
      }
      slugify_store_name: {
        Args: { p_fallback?: string; p_name: string }
        Returns: string
      }
      touch_device_seen: { Args: { p_device_id: string }; Returns: undefined }
      verify_cashier_pin: {
        Args: { p_device_id: string; p_pin: string; p_store_id: string }
        Returns: string
      }
      void_order: {
        Args: { p_actor_id?: string; p_order_id: string }
        Returns: Json
      }
    }
  Enums: {
      batch_source_type:
        | "purchase"
        | "opening_stock"
        | "transfer"
        | "production"
        | "adjustment"
      business_activity_type:
        | "cafe"
        | "ice_cream"
        | "restaurant"
        | "supermarket"
        | "retail"
        | "wholesale"
        | "mixed"
        | "juice_bar"
      cashier_vault_entry_type:
        | "session_close_deposit"
        | "session_open_float"
        | "admin_withdraw"
      cost_center_type:
        | "operations"
        | "cleaning"
        | "utilities"
        | "packaging"
        | "maintenance"
        | "salaries"
        | "marketing"
        | "other"
      customer_ledger_entry_type:
        | "credit_sale"
        | "payment_received"
        | "refund"
        | "adjustment"
      expense_payment_method: "cash" | "card" | "wallet" | "other"
      expense_source: "session_cash" | "external" | "purchase"
      expense_status: "pending" | "approved"
      expiry_policy_type: "block_sale" | "warn_only" | "manager_override"
      import_job_status: "pending" | "completed" | "failed"
      inventory_product_type:
        | "finished_product"
        | "raw_material"
        | "semi_finished"
        | "packaging_material"
        | "consumable"
        | "service"
        | "asset"
      inventory_rotation_method: "FIFO" | "FEFO" | "MANUAL"
      inventory_tracking_mode:
        | "none"
        | "standard"
        | "batch"
        | "batch_and_expiry"
        | "serial_number"
      measurement_unit:
        | "piece"
        | "bag"
        | "cup"
        | "spoon"
        | "gram"
        | "kg"
        | "ml"
        | "liter"
        | "carton"
        | "box"
        | "pack"
        | "meter"
      monthly_close_status: "draft" | "closed" | "reopened"
      movement_type:
        | "sale"
        | "purchase"
        | "transfer_in"
        | "transfer_out"
        | "waste"
        | "adjustment"
        | "stock_count"
        | "purchase_from_session"
        | "reservation"
        | "reservation_release"
      online_order_status:
        | "pending"
        | "accepted"
        | "preparing"
        | "ready"
        | "cancelled"
        | "invoiced"
      order_status: "open" | "completed" | "voided" | "refunded"
      payment_method: "cash" | "card" | "other" | "wallet" | "credit"
      payment_status: "paid" | "unpaid" | "partial"
      product_sales_unit_type: "piece" | "weight" | "volume" | "pack" | "mixed"
      product_type: "finished" | "ingredient"
      purchase_status: "draft" | "received" | "cancelled"
      sales_mode: "retail" | "wholesale"
      session_status: "open" | "closed"
      shelf_life_unit_type: "days" | "months" | "years"
      stock_count_status: "in_progress" | "completed"
      transfer_status: "draft" | "sent" | "received" | "cancelled"
      user_role: "owner" | "manager" | "cashier" | "viewer" | "inventory"
      variant_kind: "standard" | "weight_portion"
      variant_price_mode: "calculate_from_unit_price" | "fixed_price"
      weight_sale_input_mode: "by_weight" | "by_amount"
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

/** Convenience row aliases used by repositories/mappers. */
export type AppSettingRow = Tables<"app_settings">
export type AuditLogRow = Tables<"audit_logs">
export type CategoryRow = Tables<"categories">
export type CustomerRow = Tables<"customers">
export type DeviceRow = Tables<"devices">
export type ExpenseRow = Tables<"expenses">
export type ExpenseCategoryRow = Tables<"expense_categories">
export type CostCenterRow = Tables<"cost_centers">
export type PermissionRow = Tables<"permissions">
export type ImportJobRow = Tables<"import_jobs">
export type LoyaltyLedgerRow = Tables<"loyalty_ledger">
export type LoyaltyRuleRow = Tables<"loyalty_rules">
export type MovementRow = Tables<"inventory_movements">
export type OrderItemDeductionRow = Tables<"order_item_deductions">
export type OrderItemRow = Tables<"order_items">
export type OrderPaymentRow = Tables<"order_payments">
export type OnlineOrderItemRow = Tables<"online_order_items">
export type OnlineOrderRow = Tables<"online_orders">
export type OrderRow = Tables<"orders">
export type OrganizationRow = Tables<"organizations">
export type ProductRow = Tables<"products">
export type RecipeLineRow = Tables<"product_recipe_lines">
export type RecipeRow = Tables<"product_recipes">
export type PurchaseLineRow = Tables<"purchase_invoice_lines">
export type PurchaseRow = Tables<"purchase_invoices">
export type SupplierPaymentRow = Tables<"supplier_payments">
export type CashierVaultLedgerRow = Tables<"cashier_vault_ledger">
export type CashierVaultRow = Tables<"cashier_vaults">
export type SessionRow = Tables<"cashier_sessions">
export type StockCountLineRow = Tables<"stock_count_lines">
export type StockCountRow = Tables<"stock_counts">
export type StockLevelRow = Tables<"stock_levels">
export type StoreRow = Tables<"stores">
export type SupplierRow = Tables<"suppliers">
export type TransferLineRow = Tables<"transfer_order_lines">
export type TransferRow = Tables<"transfer_orders">
export type UserRow = Tables<"users">
export type VariantRow = Tables<"product_variants">
export type WasteRow = Tables<"waste_records">
export type WarehouseRow = Tables<"warehouses">

export const Constants = {
  public: {
    Enums: {
      batch_source_type: [
        "purchase",
        "opening_stock",
        "transfer",
        "production",
        "adjustment",
      ],
      business_activity_type: [
        "cafe",
        "ice_cream",
        "restaurant",
        "supermarket",
        "retail",
        "wholesale",
        "mixed",
        "juice_bar",
      ],
      cashier_vault_entry_type: [
        "session_close_deposit",
        "session_open_float",
        "admin_withdraw",
      ],
      cost_center_type: [
        "operations",
        "cleaning",
        "utilities",
        "packaging",
        "maintenance",
        "salaries",
        "marketing",
        "other",
      ],
      customer_ledger_entry_type: [
        "credit_sale",
        "payment_received",
        "refund",
        "adjustment",
      ],
      expense_payment_method: ["cash", "card", "wallet", "other"],
      expense_source: ["session_cash", "external", "purchase"],
      expense_status: ["pending", "approved"],
      expiry_policy_type: ["block_sale", "warn_only", "manager_override"],
      import_job_status: ["pending", "completed", "failed"],
      inventory_product_type: [
        "finished_product",
        "raw_material",
        "semi_finished",
        "packaging_material",
        "consumable",
        "service",
        "asset",
      ],
      inventory_rotation_method: ["FIFO", "FEFO", "MANUAL"],
      inventory_tracking_mode: [
        "none",
        "standard",
        "batch",
        "batch_and_expiry",
        "serial_number",
      ],
      measurement_unit: [
        "piece",
        "bag",
        "cup",
        "spoon",
        "gram",
        "kg",
        "ml",
        "liter",
        "carton",
        "box",
        "pack",
        "meter",
      ],
      monthly_close_status: ["draft", "closed", "reopened"],
      movement_type: [
        "sale",
        "purchase",
        "transfer_in",
        "transfer_out",
        "waste",
        "adjustment",
        "stock_count",
        "purchase_from_session",
        "reservation",
        "reservation_release",
      ],
      online_order_status: [
        "pending",
        "accepted",
        "preparing",
        "ready",
        "cancelled",
        "invoiced",
      ],
      order_status: ["open", "completed", "voided", "refunded"],
      payment_method: ["cash", "card", "other", "wallet", "credit"],
      payment_status: ["paid", "unpaid", "partial"],
      product_sales_unit_type: ["piece", "weight", "volume", "pack", "mixed"],
      product_type: ["finished", "ingredient"],
      purchase_status: ["draft", "received", "cancelled"],
      sales_mode: ["retail", "wholesale"],
      session_status: ["open", "closed"],
      shelf_life_unit_type: ["days", "months", "years"],
      stock_count_status: ["in_progress", "completed"],
      transfer_status: ["draft", "sent", "received", "cancelled"],
      user_role: ["owner", "manager", "cashier", "viewer", "inventory"],
      variant_kind: ["standard", "weight_portion"],
      variant_price_mode: ["calculate_from_unit_price", "fixed_price"],
      weight_sale_input_mode: ["by_weight", "by_amount"],
    },
  },
} as const
