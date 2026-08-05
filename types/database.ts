/**
 * Supabase database types.
 *
 * THIS FILE IS GENERATED — do not edit it by hand.
 *
 *   npm run db:types          # from supabase/migrations via PGlite (no Docker)
 *   npm run db:types:remote   # from the linked hosted project
 *
 * Produced by `@supabase/postgres-meta` — the same generator the Supabase CLI
 * runs inside its container — introspecting a PGlite database with every
 * migration in `supabase/migrations/` applied. See `scripts/db-types.mjs`.
 *
 * It therefore describes **the migrations in this repository**, which for the
 * `public` schema is the whole definition. It cannot see drift applied to a
 * hosted project outside migrations: re-run `db:types:remote` once a project is
 * linked, and treat a diff as a schema that has drifted.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          job_title: string | null
          last_seen_at: string | null
          notes: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          last_seen_at?: string | null
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          job_title?: string | null
          last_seen_at?: string | null
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          changes: Json | null
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          changes?: Json | null
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      banner_translations: {
        Row: {
          banner_id: string
          created_at: string
          created_by: string | null
          cta_label: string | null
          locale: Database["public"]["Enums"]["locale"]
          subtitle: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          banner_id: string
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          locale: Database["public"]["Enums"]["locale"]
          subtitle?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          banner_id?: string
          created_at?: string
          created_by?: string | null
          cta_label?: string | null
          locale?: Database["public"]["Enums"]["locale"]
          subtitle?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banner_translations_banner_id_fkey"
            columns: ["banner_id"]
            isOneToOne: false
            referencedRelation: "site_banners"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_translations: {
        Row: {
          brand_id: string
          canonical_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          locale: Database["public"]["Enums"]["locale"]
          og_description: string | null
          og_image_path: string | null
          og_title: string | null
          seo_description: string | null
          seo_keywords: string[]
          seo_title: string | null
          twitter_card: Database["public"]["Enums"]["twitter_card"] | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          brand_id: string
          canonical_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          locale: Database["public"]["Enums"]["locale"]
          og_description?: string | null
          og_image_path?: string | null
          og_title?: string | null
          seo_description?: string | null
          seo_keywords?: string[]
          seo_title?: string | null
          twitter_card?: Database["public"]["Enums"]["twitter_card"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          brand_id?: string
          canonical_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          locale?: Database["public"]["Enums"]["locale"]
          og_description?: string | null
          og_image_path?: string | null
          og_title?: string | null
          seo_description?: string | null
          seo_keywords?: string[]
          seo_title?: string | null
          twitter_card?: Database["public"]["Enums"]["twitter_card"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_translations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_featured: boolean
          is_visible: boolean
          logo_path: string | null
          name: string
          slug: string
          updated_at: string
          updated_by: string | null
          website_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_featured?: boolean
          is_visible?: boolean
          logo_path?: string | null
          name: string
          slug: string
          updated_at?: string
          updated_by?: string | null
          website_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_featured?: boolean
          is_visible?: boolean
          logo_path?: string | null
          name?: string
          slug?: string
          updated_at?: string
          updated_by?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          depth: number
          display_order: number
          id: string
          image_path: string | null
          is_visible: boolean
          parent_id: string | null
          path: string[]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          depth?: number
          display_order?: number
          id?: string
          image_path?: string | null
          is_visible?: boolean
          parent_id?: string | null
          path?: string[]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          depth?: number
          display_order?: number
          id?: string
          image_path?: string | null
          is_visible?: boolean
          parent_id?: string | null
          path?: string[]
          updated_at?: string
          updated_by?: string | null
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
      category_translations: {
        Row: {
          canonical_url: string | null
          category_id: string
          created_at: string
          created_by: string | null
          description: string | null
          locale: Database["public"]["Enums"]["locale"]
          name: string
          og_description: string | null
          og_image_path: string | null
          og_title: string | null
          seo_description: string | null
          seo_keywords: string[]
          seo_title: string | null
          slug: string | null
          twitter_card: Database["public"]["Enums"]["twitter_card"] | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          canonical_url?: string | null
          category_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          locale: Database["public"]["Enums"]["locale"]
          name: string
          og_description?: string | null
          og_image_path?: string | null
          og_title?: string | null
          seo_description?: string | null
          seo_keywords?: string[]
          seo_title?: string | null
          slug?: string | null
          twitter_card?: Database["public"]["Enums"]["twitter_card"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          canonical_url?: string | null
          category_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          locale?: Database["public"]["Enums"]["locale"]
          name?: string
          og_description?: string | null
          og_image_path?: string | null
          og_title?: string | null
          seo_description?: string | null
          seo_keywords?: string[]
          seo_title?: string | null
          slug?: string | null
          twitter_card?: Database["public"]["Enums"]["twitter_card"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_translations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      content_page_translations: {
        Row: {
          body: string | null
          canonical_url: string | null
          created_at: string
          created_by: string | null
          excerpt: string | null
          locale: Database["public"]["Enums"]["locale"]
          og_description: string | null
          og_image_path: string | null
          og_title: string | null
          page_id: string
          search_vector: unknown
          seo_description: string | null
          seo_keywords: string[]
          seo_title: string | null
          slug: string | null
          title: string
          twitter_card: Database["public"]["Enums"]["twitter_card"] | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string | null
          canonical_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          locale: Database["public"]["Enums"]["locale"]
          og_description?: string | null
          og_image_path?: string | null
          og_title?: string | null
          page_id: string
          search_vector?: unknown
          seo_description?: string | null
          seo_keywords?: string[]
          seo_title?: string | null
          slug?: string | null
          title: string
          twitter_card?: Database["public"]["Enums"]["twitter_card"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string | null
          canonical_url?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          locale?: Database["public"]["Enums"]["locale"]
          og_description?: string | null
          og_image_path?: string | null
          og_title?: string | null
          page_id?: string
          search_vector?: unknown
          seo_description?: string | null
          seo_keywords?: string[]
          seo_title?: string | null
          slug?: string | null
          title?: string
          twitter_card?: Database["public"]["Enums"]["twitter_card"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_page_translations_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "content_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      content_pages: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          display_order: number
          id: string
          is_published: boolean
          key: string
          published_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_order?: number
          id?: string
          is_published?: boolean
          key: string
          published_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_order?: number
          id?: string
          is_published?: boolean
          key?: string
          published_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          allow_backorder: boolean
          created_at: string
          id: string
          low_stock_threshold: number
          product_id: string
          quantity_on_hand: number
          quantity_reserved: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          allow_backorder?: boolean
          created_at?: string
          id?: string
          low_stock_threshold?: number
          product_id: string
          quantity_on_hand?: number
          quantity_reserved?: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          allow_backorder?: boolean
          created_at?: string
          id?: string
          low_stock_threshold?: number
          product_id?: string
          quantity_on_hand?: number
          quantity_reserved?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          product_id: string
          quantity_after: number
          quantity_delta: number
          reason: string | null
          reference: string | null
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          product_id: string
          quantity_after: number
          quantity_delta: number
          reason?: string | null
          reference?: string | null
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: Database["public"]["Enums"]["inventory_movement_type"]
          product_id?: string
          quantity_after?: number
          quantity_delta?: number
          reason?: string | null
          reference?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          key: string
          resource: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          key: string
          resource: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          resource?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          created_by: string | null
          display_order: number
          height: number | null
          id: string
          is_primary: boolean
          product_id: string
          storage_path: string
          variant_id: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          height?: number | null
          id?: string
          is_primary?: boolean
          product_id: string
          storage_path: string
          variant_id?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          height?: number | null
          id?: string
          is_primary?: boolean
          product_id?: string
          storage_path?: string
          variant_id?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_translations: {
        Row: {
          created_at: string
          locale: Database["public"]["Enums"]["locale"]
          name: string
          option_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          locale: Database["public"]["Enums"]["locale"]
          name: string
          option_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          locale?: Database["public"]["Enums"]["locale"]
          name?: string
          option_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_translations_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
        ]
      }
      product_option_values: {
        Row: {
          created_at: string
          id: string
          option_id: string
          position: number
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          position?: number
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          position?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_option_values_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key: string
          position: number
          product_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key: string
          position?: number
          product_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key?: string
          position?: number
          product_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_specifications: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          product_id: string
          spec_group: string | null
          unit: string | null
          value: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          product_id: string
          spec_group?: string | null
          unit?: string | null
          value: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          product_id?: string
          spec_group?: string | null
          unit?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_specifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_translations: {
        Row: {
          canonical_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          locale: Database["public"]["Enums"]["locale"]
          name: string
          og_description: string | null
          og_image_path: string | null
          og_title: string | null
          product_id: string
          search_vector: unknown
          seo_description: string | null
          seo_keywords: string[]
          seo_title: string | null
          short_description: string | null
          slug: string | null
          twitter_card: Database["public"]["Enums"]["twitter_card"] | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          canonical_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          locale: Database["public"]["Enums"]["locale"]
          name: string
          og_description?: string | null
          og_image_path?: string | null
          og_title?: string | null
          product_id: string
          search_vector?: unknown
          seo_description?: string | null
          seo_keywords?: string[]
          seo_title?: string | null
          short_description?: string | null
          slug?: string | null
          twitter_card?: Database["public"]["Enums"]["twitter_card"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          canonical_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          locale?: Database["public"]["Enums"]["locale"]
          name?: string
          og_description?: string | null
          og_image_path?: string | null
          og_title?: string | null
          product_id?: string
          search_vector?: unknown
          seo_description?: string | null
          seo_keywords?: string[]
          seo_title?: string | null
          short_description?: string | null
          slug?: string | null
          twitter_card?: Database["public"]["Enums"]["twitter_card"] | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_translations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variant_options: {
        Row: {
          option_id: string
          value_id: string
          variant_id: string
        }
        Insert: {
          option_id: string
          value_id: string
          variant_id: string
        }
        Update: {
          option_id?: string
          value_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_options_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variant_options_value_id_fkey"
            columns: ["value_id"]
            isOneToOne: false
            referencedRelation: "product_option_values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variant_options_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          cost_price_cents: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          position: number
          price_cents: number
          product_id: string
          sale_price_cents: number | null
          sku: string
          updated_at: string
          updated_by: string | null
          weight_grams: number | null
        }
        Insert: {
          barcode?: string | null
          cost_price_cents?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          position?: number
          price_cents: number
          product_id: string
          sale_price_cents?: number | null
          sku: string
          updated_at?: string
          updated_by?: string | null
          weight_grams?: number | null
        }
        Update: {
          barcode?: string | null
          cost_price_cents?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          position?: number
          price_cents?: number
          product_id?: string
          sale_price_cents?: number | null
          sku?: string
          updated_at?: string
          updated_by?: string | null
          weight_grams?: number | null
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
          brand_id: string | null
          category_id: string | null
          cost_price_cents: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          height_mm: number | null
          id: string
          is_featured: boolean
          length_mm: number | null
          price_cents: number
          published_at: string | null
          sale_price_cents: number | null
          sku: string
          status: Database["public"]["Enums"]["product_status"]
          updated_at: string
          updated_by: string | null
          visibility: Database["public"]["Enums"]["product_visibility"]
          warranty_months: number | null
          weight_grams: number | null
          width_mm: number | null
        }
        Insert: {
          brand_id?: string | null
          category_id?: string | null
          cost_price_cents?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          height_mm?: number | null
          id?: string
          is_featured?: boolean
          length_mm?: number | null
          price_cents: number
          published_at?: string | null
          sale_price_cents?: number | null
          sku: string
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
          updated_by?: string | null
          visibility?: Database["public"]["Enums"]["product_visibility"]
          warranty_months?: number | null
          weight_grams?: number | null
          width_mm?: number | null
        }
        Update: {
          brand_id?: string | null
          category_id?: string | null
          cost_price_cents?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          height_mm?: number | null
          id?: string
          is_featured?: boolean
          length_mm?: number | null
          price_cents?: number
          published_at?: string | null
          sale_price_cents?: number | null
          sku?: string
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
          updated_by?: string | null
          visibility?: Database["public"]["Enums"]["product_visibility"]
          warranty_months?: number | null
          weight_grams?: number | null
          width_mm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_system: boolean
          key: string
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      setting_translations: {
        Row: {
          created_at: string
          locale: Database["public"]["Enums"]["locale"]
          setting_key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          created_at?: string
          locale: Database["public"]["Enums"]["locale"]
          setting_key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          created_at?: string
          locale?: Database["public"]["Enums"]["locale"]
          setting_key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "setting_translations_setting_key_fkey"
            columns: ["setting_key"]
            isOneToOne: false
            referencedRelation: "settings"
            referencedColumns: ["key"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string
          description: string | null
          is_localized: boolean
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_localized?: boolean
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          is_localized?: boolean
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      site_banners: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          display_order: number
          ends_at: string | null
          id: string
          image_path: string | null
          is_active: boolean
          link_url: string | null
          placement: Database["public"]["Enums"]["banner_placement"]
          starts_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_order?: number
          ends_at?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          link_url?: string | null
          placement: Database["public"]["Enums"]["banner_placement"]
          starts_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_order?: number
          ends_at?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          link_url?: string | null
          placement?: Database["public"]["Enums"]["banner_placement"]
          starts_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          created_at: string
          id: string
          note: string | null
          product_id: string
          wishlist_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          product_id: string
          wishlist_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          product_id?: string
          wishlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_items_wishlist_id_fkey"
            columns: ["wishlist_id"]
            isOneToOne: false
            referencedRelation: "wishlists"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_permission: { Args: { permission_key: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_product_published: { Args: { p_product_id: string }; Returns: boolean }
      is_valid_slug: { Args: { value: string }; Returns: boolean }
      text_search_config: {
        Args: { loc: Database["public"]["Enums"]["locale"] }
        Returns: unknown
      }
    }
    Enums: {
      banner_placement:
        "home_hero" | "home_secondary" | "category_top" | "site_wide_notice"
      inventory_movement_type:
        "purchase" | "adjustment" | "correction" | "sale" | "return"
      locale: "uz" | "ru" | "en"
      product_status: "draft" | "active" | "archived"
      product_visibility: "public" | "hidden"
      twitter_card: "summary" | "summary_large_image"
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
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
    Enums: {
      banner_placement: [
        "home_hero",
        "home_secondary",
        "category_top",
        "site_wide_notice",
      ],
      inventory_movement_type: [
        "purchase",
        "adjustment",
        "correction",
        "sale",
        "return",
      ],
      locale: ["uz", "ru", "en"],
      product_status: ["draft", "active", "archived"],
      product_visibility: ["public", "hidden"],
      twitter_card: ["summary", "summary_large_image"],
    },
  },
} as const
