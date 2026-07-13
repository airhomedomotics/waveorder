const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  // 1. Trova l'utente (cerca per admin@waveorder.com o Giordani@outlook.it)
  const { data: users, error: findError } = await supabase.auth.admin.listUsers();
  if (findError) {
    console.error("Errore listUsers:", findError);
    return;
  }
  
  let user = users.users.find(u => u.email.toLowerCase() === 'admin@waveorder.com' || u.email.toLowerCase() === 'giordani@outlook.it');
  
  if (!user) {
    console.log("Utente admin non trovato!");
    return;
  }

  // 2. Aggiorna l'utente con l'API corretta di Supabase (che gestisce l'hashing)
  const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    email: 'Giordani@outlook.it',
    password: '130484Mic@',
    email_confirm: true
  });

  if (updateError) {
    console.error("Errore aggiornamento:", updateError);
  } else {
    console.log("Utente aggiornato con successo!", updateData.user.email);
  }
}
main();
