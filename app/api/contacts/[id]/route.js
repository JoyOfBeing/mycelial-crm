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

export async function GET(request, { params }) {
  const authError = checkApiKey(request);
  if (authError) return authError;

  const { id } = await params;

  const { data: contact, error } = await supabase
    .from('crm_contacts')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !contact) return Response.json({ error: 'Contact not found' }, { status: 404 });

  const { data: notes } = await supabase
    .from('crm_notes')
    .select('*')
    .eq('contact_id', id)
    .order('created_at', { ascending: false });

  return Response.json({ contact, notes: notes || [] });
}

export async function POST(request, { params }) {
  const authError = checkApiKey(request);
  if (authError) return authError;

  const { id } = await params;
  const { content, note_type } = await request.json();

  if (!content) return Response.json({ error: 'content is required' }, { status: 400 });

  const { data: note, error } = await supabase
    .from('crm_notes')
    .insert({
      contact_id: id,
      content,
      note_type: note_type || 'manual',
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  await supabase
    .from('crm_contacts')
    .update({ last_interaction_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id);

  return Response.json({ note });
}
