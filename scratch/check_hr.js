import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://nixubrappucqeusjtome.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5peHVicmFwcHVjcWV1c2p0b21lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5Mjc3MjQsImV4cCI6MjA5MjUwMzcyNH0.Xt_amvs5Rcb5T6jvAolaIQFGu2XSW2-5wyp4y0zTBTk";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function checkHR() {
  const { data, error } = await supabase.from('profiles').select('name, email, role').eq('role', 'hr')
  if (error) console.error(error)
  else console.log("HR Users:", data)
}

checkHR()
