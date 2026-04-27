import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function checkApiKey(request) {
  const key = request.headers.get('x-api-key') || new URL(request.url).searchParams.get('api_key');
  if (!key || key !== process.env.CRM_API_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export async function GET(request) {
  const authError = checkApiKey(request);
  if (authError) return authError;

  const { count: total } = await supabase
    .from('crm_contacts')
    .select('*', { count: 'exact', head: true });

  const sources = ['network', 'client-lead', 'contractor', 'videoask', 'mixed', 'wix', 'crowdcast', 'investors'];
  const sourceCounts = {};
  for (const s of sources) {
    const { count } = await supabase
      .from('crm_contacts')
      .select('*', { count: 'exact', head: true })
      .filter('sources', 'cs', `["${s}"]`);
    if (count > 0) sourceCounts[s] = count;
  }

  const { count: withVideo } = await supabase
    .from('crm_contacts')
    .select('*', { count: 'exact', head: true })
    .not('video_url', 'is', null);

  const { count: withBio } = await supabase
    .from('crm_contacts')
    .select('*', { count: 'exact', head: true })
    .not('bio', 'is', null);

  const { count: notesCount } = await supabase
    .from('crm_notes')
    .select('*', { count: 'exact', head: true });

  return Response.json({ total, sourceCounts, withVideo, withBio, notesCount });
}
