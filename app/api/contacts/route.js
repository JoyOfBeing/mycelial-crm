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

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const source = searchParams.get('source');
  const tag = searchParams.get('tag');
  const role = searchParams.get('role');
  const skill = searchParams.get('skill');
  const interest = searchParams.get('interest');
  const has_video = searchParams.get('has_video');
  const stale_days = searchParams.get('stale_days');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  let query = supabase
    .from('crm_contacts')
    .select('id, full_name, first_name, last_name, email, company, phone, website, bio, roles, skills, interests, services_needed, business_size, client_notes, video_url, video_transcript, video_duration, calendly_completed, hourly_rate, title, specialties, status, sources, tags, last_interaction_at, created_at, updated_at', { count: 'exact' });

  if (search) query = query.textSearch('search_vector', search, { type: 'websearch' });
  if (source) query = query.filter('sources', 'cs', `["${source}"]`);
  if (tag) query = query.filter('tags', 'cs', `["${tag}"]`);
  if (role) query = query.filter('roles', 'cs', `["${role}"]`);
  if (skill) query = query.filter('skills', 'cs', `["${skill}"]`);
  if (interest) query = query.ilike('interests', `%${interest}%`);
  if (has_video === 'true') query = query.not('video_url', 'is', null);
  if (stale_days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(stale_days));
    query = query.or(`last_interaction_at.is.null,last_interaction_at.lt.${cutoff.toISOString()}`);
  }

  query = query.order('full_name', { ascending: true, nullsFirst: false });
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ total: count, limit, offset, contacts: data });
}
