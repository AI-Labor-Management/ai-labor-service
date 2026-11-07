// 자동 생성: Supabase generate_typescript_types (nomu-service, 2026-11-06). 직접 고치지 말고 스키마를 바꾼 뒤 다시 생성하세요.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_access_log: {
        Row: {
          admin_id: string | null
          at: string
          id: string
          screen: string
        }
        Insert: {
          admin_id?: string | null
          at?: string
          id?: string
          screen: string
        }
        Update: {
          admin_id?: string | null
          at?: string
          id?: string
          screen?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          count: number
          day: string
          user_id: string
        }
        Insert: {
          count?: number
          day: string
          user_id: string
        }
        Update: {
          count?: number
          day?: string
          user_id?: string
        }
        Relationships: []
      }
      admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          note: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          note?: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          note?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      attendance_edits: {
        Row: {
          after_in: string | null
          after_out: string | null
          at: string
          before_in: string | null
          before_out: string | null
          by_user: string | null
          employee_response_at: string | null
          employee_response_memo: string
          employee_response_status: string | null
          id: string
          reason: string
          record_id: string
          workplace_id: string
        }
        Insert: {
          after_in?: string | null
          after_out?: string | null
          at?: string
          before_in?: string | null
          before_out?: string | null
          by_user?: string | null
          employee_response_at?: string | null
          employee_response_memo?: string
          employee_response_status?: string | null
          id?: string
          reason: string
          record_id: string
          workplace_id: string
        }
        Update: {
          after_in?: string | null
          after_out?: string | null
          at?: string
          before_in?: string | null
          before_out?: string | null
          by_user?: string | null
          employee_response_at?: string | null
          employee_response_memo?: string
          employee_response_status?: string | null
          id?: string
          reason?: string
          record_id?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_edits_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_edits_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          approval: string | null
          confirmed_at: string | null
          created_at: string
          date: string
          employee_id: string
          gps: string | null
          id: string
          original_clock_in: string | null
          original_clock_out: string | null
          reason: string
          record_no: string
          source: string
          status: string
          workplace_id: string
        }
        Insert: {
          approval?: string | null
          confirmed_at?: string | null
          created_at?: string
          date: string
          employee_id: string
          gps?: string | null
          id?: string
          original_clock_in?: string | null
          original_clock_out?: string | null
          reason?: string
          record_no: string
          source: string
          status: string
          workplace_id: string
        }
        Update: {
          approval?: string | null
          confirmed_at?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          gps?: string | null
          id?: string
          original_clock_in?: string | null
          original_clock_out?: string | null
          reason?: string
          record_no?: string
          source?: string
          status?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      busy_days: {
        Row: {
          date: string
          id: string
          memo: string
          workplace_id: string
        }
        Insert: {
          date: string
          id?: string
          memo: string
          workplace_id: string
        }
        Update: {
          date?: string
          id?: string
          memo?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "busy_days_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      condition_acks: {
        Row: {
          at: string
          condition_id: string
          employee_id: string
          id: string
          memo: string
          resolved_at: string | null
          status: string
          workplace_id: string
        }
        Insert: {
          at?: string
          condition_id: string
          employee_id: string
          id?: string
          memo?: string
          resolved_at?: string | null
          status: string
          workplace_id: string
        }
        Update: {
          at?: string
          condition_id?: string
          employee_id?: string
          id?: string
          memo?: string
          resolved_at?: string | null
          status?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "condition_acks_condition_id_fkey"
            columns: ["condition_id"]
            isOneToOne: false
            referencedRelation: "work_conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "condition_acks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "condition_acks_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      consult_requests: {
        Row: {
          consent_at: string
          created_at: string
          employee_ids: string[]
          firm_id: string | null
          id: string
          memo: string
          question: string
          revoked_at: string | null
          share_items: string[]
          snapshot: Json | null
          status: string
          topic: string
          workplace_id: string
        }
        Insert: {
          consent_at: string
          created_at?: string
          employee_ids?: string[]
          firm_id?: string | null
          id?: string
          memo?: string
          question?: string
          revoked_at?: string | null
          share_items: string[]
          snapshot?: Json | null
          status?: string
          topic: string
          workplace_id: string
        }
        Update: {
          consent_at?: string
          created_at?: string
          employee_ids?: string[]
          firm_id?: string | null
          id?: string
          memo?: string
          question?: string
          revoked_at?: string | null
          share_items?: string[]
          snapshot?: Json | null
          status?: string
          topic?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consult_requests_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consult_requests_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_forms: {
        Row: {
          id: string
          name: string
          url: string
          workplace_id: string
        }
        Insert: {
          id?: string
          name: string
          url: string
          workplace_id: string
        }
        Update: {
          id?: string
          name?: string
          url?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_forms_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deadline_actions: {
        Row: {
          action: string
          at: string
          date: string
          key: string
          note: string
          workplace_id: string
        }
        Insert: {
          action: string
          at?: string
          date: string
          key: string
          note?: string
          workplace_id: string
        }
        Update: {
          action?: string
          at?: string
          date?: string
          key?: string
          note?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deadline_actions_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_records: {
        Row: {
          bulk: boolean
          done_at: string | null
          employee_id: string | null
          exam_date: string | null
          expiry: string | null
          id: string
          item_id: string
          key: string
          location: string
          na_reason: string
          status: string
          updated_at: string
          workplace_id: string
        }
        Insert: {
          bulk?: boolean
          done_at?: string | null
          employee_id?: string | null
          exam_date?: string | null
          expiry?: string | null
          id?: string
          item_id: string
          key: string
          location?: string
          na_reason?: string
          status: string
          updated_at?: string
          workplace_id: string
        }
        Update: {
          bulk?: boolean
          done_at?: string | null
          employee_id?: string | null
          exam_date?: string | null
          expiry?: string | null
          id?: string
          item_id?: string
          key?: string
          location?: string
          na_reason?: string
          status?: string
          updated_at?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_records_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_requests: {
        Row: {
          custom_name: string
          due_date: string
          employee_id: string
          expiry: string | null
          fix_reason: string
          history: Json
          id: string
          item_id: string | null
          location: string
          received_at: string | null
          requested_at: string
          status: string
          workplace_id: string
        }
        Insert: {
          custom_name: string
          due_date: string
          employee_id: string
          expiry?: string | null
          fix_reason?: string
          history?: Json
          id?: string
          item_id?: string | null
          location?: string
          received_at?: string | null
          requested_at: string
          status: string
          workplace_id: string
        }
        Update: {
          custom_name?: string
          due_date?: string
          employee_id?: string
          expiry?: string | null
          fix_reason?: string
          history?: Json
          id?: string
          item_id?: string | null
          location?: string
          received_at?: string | null
          requested_at?: string
          status?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_requests_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_foreign_info: {
        Row: {
          checked_at: string | null
          employee_id: string
          expiry: string | null
          nationality: string
          other_workplace_hours: number
          permit_hours: number | null
          permitted: boolean | null
          visa: string
          workplace_id: string
        }
        Insert: {
          checked_at?: string | null
          employee_id: string
          expiry?: string | null
          nationality?: string
          other_workplace_hours?: number
          permit_hours?: number | null
          permitted?: boolean | null
          visa: string
          workplace_id: string
        }
        Update: {
          checked_at?: string | null
          employee_id?: string
          expiry?: string | null
          nationality?: string
          other_workplace_hours?: number
          permit_hours?: number | null
          permitted?: boolean | null
          visa?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_foreign_info_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_foreign_info_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          account_status: string
          age_band: string
          alias: string
          birth_date: string | null
          bonus_annual: number
          contract_end: string | null
          created_at: string
          employment_type: string
          food_handler: boolean
          hire_date: string
          id: string
          insurance_method: string
          is_foreign: boolean
          lang: string
          leave_allowance_annual: number
          location_consent_at: string | null
          location_consent_revoked_at: string | null
          location_consent_version: string | null
          onboarding: string
          probation_end: string | null
          registered_at: string
          resign_date: string | null
          resign_type: string | null
          school: string | null
          started_before_65: boolean | null
          updated_at: string
          user_id: string | null
          workplace_id: string
        }
        Insert: {
          account_status?: string
          age_band: string
          alias: string
          birth_date?: string | null
          bonus_annual?: number
          contract_end?: string | null
          created_at?: string
          employment_type: string
          food_handler?: boolean
          hire_date: string
          id?: string
          insurance_method: string
          is_foreign?: boolean
          lang?: string
          leave_allowance_annual?: number
          location_consent_at?: string | null
          location_consent_revoked_at?: string | null
          location_consent_version?: string | null
          onboarding?: string
          probation_end?: string | null
          registered_at?: string
          resign_date?: string | null
          resign_type?: string | null
          school?: string | null
          started_before_65?: boolean | null
          updated_at?: string
          user_id?: string | null
          workplace_id: string
        }
        Update: {
          account_status?: string
          age_band?: string
          alias?: string
          birth_date?: string | null
          bonus_annual?: number
          contract_end?: string | null
          created_at?: string
          employment_type?: string
          food_handler?: boolean
          hire_date?: string
          id?: string
          insurance_method?: string
          is_foreign?: boolean
          lang?: string
          leave_allowance_annual?: number
          location_consent_at?: string | null
          location_consent_revoked_at?: string | null
          location_consent_version?: string | null
          onboarding?: string
          probation_end?: string | null
          registered_at?: string
          resign_date?: string | null
          resign_type?: string | null
          school?: string | null
          started_before_65?: boolean | null
          updated_at?: string
          user_id?: string | null
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      firm_members: {
        Row: {
          created_at: string
          firm_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          firm_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          firm_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "firm_members_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      firms: {
        Row: {
          created_at: string
          display_public: boolean
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          display_public?: boolean
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          display_public?: boolean
          id?: string
          name?: string
        }
        Relationships: []
      }
      guest_consults: {
        Row: {
          consent_collect_at: string
          consent_provide_at: string
          contact_time: string
          created_at: string
          firm_id: string | null
          id: string
          nickname: string
          phone_ciphertext: string
          phone_key: string
          phone_masked: string
          purge_after: string
          summary: string
          topic: string
        }
        Insert: {
          consent_collect_at: string
          consent_provide_at: string
          contact_time: string
          created_at?: string
          firm_id?: string | null
          id?: string
          nickname: string
          phone_ciphertext: string
          phone_key: string
          phone_masked: string
          purge_after?: string
          summary?: string
          topic: string
        }
        Update: {
          consent_collect_at?: string
          consent_provide_at?: string
          contact_time?: string
          created_at?: string
          firm_id?: string | null
          id?: string
          nickname?: string
          phone_ciphertext?: string
          phone_key?: string
          phone_masked?: string
          purge_after?: string
          summary?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_consults_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_notices: {
        Row: {
          amounts: Json
          employee_id: string
          entered_at: string
          from_month: string
          id: string
          workplace_id: string
        }
        Insert: {
          amounts: Json
          employee_id: string
          entered_at?: string
          from_month: string
          id?: string
          workplace_id: string
        }
        Update: {
          amounts?: Json
          employee_id?: string
          entered_at?: string
          from_month?: string
          id?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_notices_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_notices_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_reports: {
        Row: {
          by_role: string | null
          date: string | null
          employee_id: string
          phase: string
          status: string
          updated_at: string
          workplace_id: string
        }
        Insert: {
          by_role?: string | null
          date?: string | null
          employee_id: string
          phase: string
          status: string
          updated_at?: string
          workplace_id: string
        }
        Update: {
          by_role?: string | null
          date?: string | null
          employee_id?: string
          phase?: string
          status?: string
          updated_at?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_reports_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_reports_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          created_at: string
          employee_id: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
          workplace_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
          workplace_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          adjust_reason: string
          date: string
          decided_at: string | null
          employee_id: string
          hours: number | null
          id: string
          requested_at: string
          requested_by: string
          status: string
          workplace_id: string
        }
        Insert: {
          adjust_reason?: string
          date: string
          decided_at?: string | null
          employee_id: string
          hours?: number | null
          id?: string
          requested_at?: string
          requested_by: string
          status: string
          workplace_id: string
        }
        Update: {
          adjust_reason?: string
          date?: string
          decided_at?: string | null
          employee_id?: string
          hours?: number | null
          id?: string
          requested_at?: string
          requested_by?: string
          status?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          channel: string
          created_at: string
          deadline_key: string
          detail: string
          id: string
          sent_on: string
          status: string
          workplace_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          deadline_key: string
          detail?: string
          id?: string
          sent_on: string
          status: string
          workplace_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          deadline_key?: string
          detail?: string
          id?: string
          sent_on?: string
          status?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          employee_id: string | null
          id: string
          kakao_status: string
          kind: string
          link: string
          read_at: string | null
          recipient: string
          text: string
          workplace_id: string
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          id?: string
          kakao_status?: string
          kind: string
          link?: string
          read_at?: string | null
          recipient: string
          text: string
          workplace_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          id?: string
          kakao_status?: string
          kind?: string
          link?: string
          read_at?: string | null
          recipient?: string
          text?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      offboarding_progress: {
        Row: {
          completed_at: string | null
          employee_id: string
          started_at: string
          steps: Json
          workplace_id: string
        }
        Insert: {
          completed_at?: string | null
          employee_id: string
          started_at?: string
          steps?: Json
          workplace_id: string
        }
        Update: {
          completed_at?: string | null
          employee_id?: string
          started_at?: string
          steps?: Json
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offboarding_progress_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offboarding_progress_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_edits: {
        Row: {
          after_value: string
          at: string
          before_value: string
          employee_id: string
          field: string
          id: string
          payroll_id: string
          reason: string
          workplace_id: string
        }
        Insert: {
          after_value: string
          at?: string
          before_value: string
          employee_id: string
          field: string
          id?: string
          payroll_id: string
          reason: string
          workplace_id: string
        }
        Update: {
          after_value?: string
          at?: string
          before_value?: string
          employee_id?: string
          field?: string
          id?: string
          payroll_id?: string
          reason?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_edits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_edits_payroll_id_fkey"
            columns: ["payroll_id"]
            isOneToOne: false
            referencedRelation: "payroll_months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_edits_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_lines: {
        Row: {
          created_at: string
          deduction_total: number
          employee_id: string
          gross: number
          id: string
          line: Json
          net: number
          net_complete: boolean
          payroll_id: string
          revision: number
          workplace_id: string
        }
        Insert: {
          created_at?: string
          deduction_total: number
          employee_id: string
          gross: number
          id?: string
          line: Json
          net: number
          net_complete: boolean
          payroll_id: string
          revision?: number
          workplace_id: string
        }
        Update: {
          created_at?: string
          deduction_total?: number
          employee_id?: string
          gross?: number
          id?: string
          line?: Json
          net?: number
          net_complete?: boolean
          payroll_id?: string
          revision?: number
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_lines_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_lines_payroll_id_fkey"
            columns: ["payroll_id"]
            isOneToOne: false
            referencedRelation: "payroll_months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_lines_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_manual: {
        Row: {
          adjustments: Json
          employee_id: string
          income_tax: number | null
          local_tax: number | null
          payroll_id: string
          workplace_id: string
        }
        Insert: {
          adjustments?: Json
          employee_id: string
          income_tax?: number | null
          local_tax?: number | null
          payroll_id: string
          workplace_id: string
        }
        Update: {
          adjustments?: Json
          employee_id?: string
          income_tax?: number | null
          local_tax?: number | null
          payroll_id?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_manual_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_manual_payroll_id_fkey"
            columns: ["payroll_id"]
            isOneToOne: false
            referencedRelation: "payroll_months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_manual_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_months: {
        Row: {
          confirmed_at: string | null
          confirmed_with_pending: string[]
          id: string
          month: string
          revision: number
          scale_confirmed: string | null
          status: string
          workplace_id: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_with_pending?: string[]
          id?: string
          month: string
          revision?: number
          scale_confirmed?: string | null
          status?: string
          workplace_id: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_with_pending?: string[]
          id?: string
          month?: string
          revision?: number
          scale_confirmed?: string | null
          status?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_months_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      review_comments: {
        Row: {
          at: string
          author_id: string | null
          comment: string
          firm_id: string
          id: string
          target: string
        }
        Insert: {
          at?: string
          author_id?: string | null
          comment: string
          firm_id: string
          id?: string
          target: string
        }
        Update: {
          at?: string
          author_id?: string | null
          comment?: string
          firm_id?: string
          id?: string
          target?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_comments_firm_id_fkey"
            columns: ["firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_answers: {
        Row: {
          answer: string
          answered_at: string
          question_id: string
          scale_at_answer: string
          workplace_id: string
        }
        Insert: {
          answer: string
          answered_at: string
          question_id: string
          scale_at_answer: string
          workplace_id: string
        }
        Update: {
          answer?: string
          answered_at?: string
          question_id?: string
          scale_at_answer?: string
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_answers_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_overrides: {
        Row: {
          break_min: number
          created_at: string
          date: string
          employee_id: string
          end_time: string | null
          id: string
          kind: string
          memo: string
          start_time: string | null
          substitution_id: string | null
          workplace_id: string
        }
        Insert: {
          break_min?: number
          created_at?: string
          date: string
          employee_id: string
          end_time?: string | null
          id?: string
          kind: string
          memo?: string
          start_time?: string | null
          substitution_id?: string | null
          workplace_id: string
        }
        Update: {
          break_min?: number
          created_at?: string
          date?: string
          employee_id?: string
          end_time?: string | null
          id?: string
          kind?: string
          memo?: string
          start_time?: string | null
          substitution_id?: string | null
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_overrides_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_overrides_substitution_id_fkey"
            columns: ["substitution_id"]
            isOneToOne: false
            referencedRelation: "substitutions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_overrides_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      statement_deliveries: {
        Row: {
          delivered_at: string
          disputed_at: string | null
          disputed_memo: string | null
          employee_id: string
          id: string
          method: string
          payroll_id: string
          revision: number
          viewed_at: string | null
          workplace_id: string
        }
        Insert: {
          delivered_at?: string
          disputed_at?: string | null
          disputed_memo?: string | null
          employee_id: string
          id?: string
          method: string
          payroll_id: string
          revision: number
          viewed_at?: string | null
          workplace_id: string
        }
        Update: {
          delivered_at?: string
          disputed_at?: string | null
          disputed_memo?: string | null
          employee_id?: string
          id?: string
          method?: string
          payroll_id?: string
          revision?: number
          viewed_at?: string | null
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_deliveries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_deliveries_payroll_id_fkey"
            columns: ["payroll_id"]
            isOneToOne: false
            referencedRelation: "payroll_months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_deliveries_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      substitutions: {
        Row: {
          created_at: string
          date: string
          decided_at: string | null
          from_employee_id: string
          id: string
          memo: string
          mode: string
          status: string
          to_employee_id: string | null
          workplace_id: string
        }
        Insert: {
          created_at?: string
          date: string
          decided_at?: string | null
          from_employee_id: string
          id?: string
          memo?: string
          mode: string
          status: string
          to_employee_id?: string | null
          workplace_id: string
        }
        Update: {
          created_at?: string
          date?: string
          decided_at?: string | null
          from_employee_id?: string
          id?: string
          memo?: string
          mode?: string
          status?: string
          to_employee_id?: string | null
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "substitutions_from_employee_id_fkey"
            columns: ["from_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_to_employee_id_fkey"
            columns: ["to_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      work_conditions: {
        Row: {
          break_waiver_requested: boolean
          created_at: string
          effective_from: string
          employee_id: string
          hourly_wage: number
          id: string
          job: string
          meal_allowance: number
          reason: string
          schedule: Json
          variable: boolean
          variable_weekly_hours: number | null
          weekly_holiday_day: number
          workplace_id: string
        }
        Insert: {
          break_waiver_requested?: boolean
          created_at?: string
          effective_from: string
          employee_id: string
          hourly_wage: number
          id?: string
          job?: string
          meal_allowance?: number
          reason?: string
          schedule?: Json
          variable?: boolean
          variable_weekly_hours?: number | null
          weekly_holiday_day?: number
          workplace_id: string
        }
        Update: {
          break_waiver_requested?: boolean
          created_at?: string
          effective_from?: string
          employee_id?: string
          hourly_wage?: number
          id?: string
          job?: string
          meal_allowance?: number
          reason?: string
          schedule?: Json
          variable?: boolean
          variable_weekly_hours?: number | null
          weekly_holiday_day?: number
          workplace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_conditions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_conditions_workplace_id_fkey"
            columns: ["workplace_id"]
            isOneToOne: false
            referencedRelation: "workplaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workplaces: {
        Row: {
          address: string
          base_date_override: string | null
          created_at: string
          default_insurance_method: string | null
          family_only: boolean
          firm_insurance_share_consent: boolean
          gps_enabled: boolean
          hourly_leave_allowed: boolean
          id: string
          industry: string
          kakao_banner_dismissed: boolean
          late_tolerance_min: number
          name: string
          owner_id: string
          partner_firm_id: string | null
          pay_day: number
          pay_month_basis: string
          radius_m: number
          scale: string
          seq: number
          updated_at: string
        }
        Insert: {
          address?: string
          base_date_override?: string | null
          created_at?: string
          default_insurance_method?: string | null
          family_only?: boolean
          firm_insurance_share_consent?: boolean
          gps_enabled?: boolean
          hourly_leave_allowed?: boolean
          id?: string
          industry: string
          kakao_banner_dismissed?: boolean
          late_tolerance_min?: number
          name?: string
          owner_id: string
          partner_firm_id?: string | null
          pay_day?: number
          pay_month_basis?: string
          radius_m?: number
          scale: string
          seq?: number
          updated_at?: string
        }
        Update: {
          address?: string
          base_date_override?: string | null
          created_at?: string
          default_insurance_method?: string | null
          family_only?: boolean
          firm_insurance_share_consent?: boolean
          gps_enabled?: boolean
          hourly_leave_allowed?: boolean
          id?: string
          industry?: string
          kakao_banner_dismissed?: boolean
          late_tolerance_min?: number
          name?: string
          owner_id?: string
          partner_firm_id?: string | null
          pay_day?: number
          pay_month_basis?: string
          radius_m?: number
          scale?: string
          seq?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workplaces_partner_firm_id_fkey"
            columns: ["partner_firm_id"]
            isOneToOne: false
            referencedRelation: "firms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { p_token: string }; Returns: string }
      ack_conditions: {
        Args: { p_condition_id: string; p_memo?: string; p_status: string }
        Returns: undefined
      }
      admin_stats: { Args: never; Returns: Json }
      ai_take: { Args: { p_limit: number; p_user: string }; Returns: number }
      apply_substitution: {
        Args: { p_employee_id: string; p_substitution_id: string }
        Returns: undefined
      }
      create_invite: { Args: { p_employee_id: string }; Returns: Json }
      delete_employee_if_unpaid: {
        Args: { p_employee_id: string }
        Returns: undefined
      }
      delete_my_workplace: { Args: never; Returns: undefined }
      dispute_attendance: {
        Args: { p_memo: string; p_record_id: string }
        Returns: undefined
      }
      dispute_statement: {
        Args: { p_delivery_id: string; p_memo: string }
        Returns: undefined
      }
      employee_context: { Args: never; Returns: Json }
      firm_consult_inbox: { Args: never; Returns: Json }
      firm_delegated_insurance: { Args: never; Returns: Json }
      firm_guest_consults: { Args: never; Returns: Json }
      firm_mark_consult_read: { Args: { p_id: string }; Returns: undefined }
      firm_mark_insurance_done: {
        Args: { p_employee_id: string; p_phase: string }
        Returns: undefined
      }
      leave_employee_app: {
        Args: { p_employee_id: string }
        Returns: undefined
      }
      mark_statement_viewed: {
        Args: { p_delivery_id: string }
        Returns: string
      }
      next_record_no: {
        Args: { p_date: string; p_workplace_id: string }
        Returns: string
      }
      request_leave: {
        Args: { p_date: string; p_employee_id: string; p_hours?: number }
        Returns: string
      }
      request_substitution: {
        Args: { p_date: string; p_employee_id: string }
        Returns: string
      }
      respond_attendance_edit: {
        Args: { p_edit_id: string; p_memo?: string; p_status: string }
        Returns: undefined
      }
      revoke_consult: { Args: { p_id: string }; Returns: undefined }
      run_retention: { Args: never; Returns: Json }
      set_location_consent: {
        Args: { p_consent: boolean; p_employee_id: string; p_version?: string }
        Returns: undefined
      }
      set_my_lang: {
        Args: { p_employee_id: string; p_lang: string }
        Returns: undefined
      }
      submit_guest_consult: {
        Args: {
          p_consent_collect: boolean
          p_consent_provide: boolean
          p_contact_time: string
          p_honeypot?: string
          p_nickname: string
          p_phone: string
          p_summary: string
          p_topic: string
        }
        Returns: Json
      }
      verify_cron_secret: { Args: { p_secret: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
