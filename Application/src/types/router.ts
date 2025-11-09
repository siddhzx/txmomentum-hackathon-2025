import type { User } from '@supabase/supabase-js'

export interface RouterContext {
  auth: {
    isAuthenticated: boolean
    user: User | null
    login: (email: string, password: string) => Promise<void>
    logout: () => Promise<void>
    isLoading: boolean
  }
}