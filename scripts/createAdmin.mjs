import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase URL or Service Role Key in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdmin() {
  const email = 'admin@modulo.com';
  const password = 'admin'; // A senha temporária para começar

  const { data, error } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
    user_metadata: {
      role: 'super_admin',
      name: 'Administrador'
    }
  });

  if (error) {
    if (error.message.includes('User already registered')) {
        console.log("Admin user already registered!");
    } else {
        console.error("Error creating user:", error.message);
    }
  } else {
    console.log("Admin user created successfully!");
    console.log("ID:", data.user.id);
    console.log("Email:", data.user.email);
  }
}

createAdmin();
