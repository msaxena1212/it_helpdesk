import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nixubrappucqeusjtome.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5peHVicmFwcHVjcWV1c2p0b21lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5Mjc3MjQsImV4cCI6MjA5MjUwMzcyNH0.Xt_amvs5Rcb5T6jvAolaIQFGu2XSW2-5wyp4y0zTBTk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
node createSuperadmin.js
async function createSuperadmin() {
  console.log('Attempting to create superadmin user...');

  const { data, error } = await supabase.auth.signUp({
    email: 'superadmin@elitemindz.co',
    password: 'V@9876543210',
    options: {
      data: {
        role: 'superadmin',
        name: 'Super Admin'
      }
    }
  });

  if (error) {
    console.error('Error creating superadmin:', error.message);
  } else {
    console.log('Superadmin created successfully!');
    console.log('User ID:', data.user?.id);
    console.log('User Metadata:', data.user?.user_metadata);
  }
}

createSuperadmin();
