import { getSupabaseServiceClient } from '../lib/supabase-service-client.js';

(async function() {
  try {
    const svc = getSupabaseServiceClient();
    const userId = process.argv[2] || '588b890b-ce25-4318-b82f-25a9b6cf71c5';
    const year = process.argv[3] || new Date().getFullYear();

    console.log('Querying view_my_finance_status for user:', userId, 'year:', year);
    const { data, error, status } = await svc
      .from('view_my_finance_status')
      .select('*')
      .eq('user_id', userId)
      .eq('fiscal_year', Number(year))
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Supabase error:', status, error.message, error.details || '');
      process.exit(1);
    }

    console.log('Result rows:', (data || []).length);
    console.dir(data, { depth: 4 });
  } catch (e) {
    console.error('Fatal error:', e?.message || e);
    process.exit(2);
  }
})();
