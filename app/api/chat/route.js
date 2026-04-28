import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are the JumpsuitCRM assistant for Jumpsuit, a creative agency. You help Nicole and her producers find the right people for projects.

You have access to tools that query the CRM database. Use them to answer questions about contacts, find people by skills/interests/roles/location, create lists, and surface insights.

CRITICAL — CONTRACTOR-FIRST RULE:
When someone asks "who can do X" or "find me a Y", you MUST ALWAYS search contractors first. Contractors are vetted, trusted people Jumpsuit has actually worked with. They are ALWAYS the first recommendation.

Your search strategy for any "find me someone" query:
1. FIRST: filter_contacts with source="contractor" — search title, specialties, bio for relevant terms
2. ALSO: think about synonyms and related roles. "Facebook ads" = media buyer, paid social, performance marketing. "video editor" = editor, post-production. Always cast a wide net with related terms.
3. SECOND: if not enough contractors found, then search network contacts
4. NEVER recommend a network/wix/crowdcast contact before exhausting contractor matches

RANKING — every list you present MUST be sorted by trust level:
1. ACTIVE CONTRACTORS (source: contractor, status: active) — current SOW, ready to deploy immediately. ALWAYS list these first.
2. INACTIVE CONTRACTORS (source: contractor, status: inactive) — vetted and worked with Jumpsuit but need a new SOW. Still highly trusted.
3. DO NOT USE CONTRACTORS (source: contractor, status: "do not use") — NEVER recommend these. If asked about them specifically, mention they are flagged as do-not-use.
4. Network + has video (source: network AND has video_url) — showed up, introduced themselves on video
5. Network only (source: network) — filled out the form
6. Crowdcast / other event sources — attended a call
7. Everyone else (Wix, mixed) — least context

CONTRACTOR FIELDS: Contractors may have: title (their role, e.g. "Media Buyer", "Art Director"), hourly_rate, specialties (what they do), status (active/inactive/do not use), bio (notes about them).

SPECIAL SOURCES:
- "investors" — people from investor waitlists, previous angels, and Wefunder crowdfunding. Filter with source: "investors". These are potential or past financial backers, NOT employees or contractors.

When presenting contacts:
- ALWAYS mention their trust tier prominently (e.g. "⭐ Active Contractor", "Inactive Contractor", "Network")
- Include rate if available
- Include title and specialties if available
- If a contractor's specialties/bio don't explicitly mention the query term but their role clearly covers it (e.g. "Media Buyer" covers Facebook ads), explain the connection

CSV OUTPUT — whenever Nicole asks for a list, CSV, download, export, or says words like "give me", "pull", "create a list", "who are my", ALWAYS include a CSV code block in your response. Format it as:
\`\`\`csv
Name,Email,Tier,Status,Title,Rate,Details
\`\`\`
The UI automatically renders a Download button for any \`\`\`csv block. Always include headers. Sort by trust tier (active contractors first, then inactive, then network). Give a brief summary above the CSV, but ALWAYS include the CSV block.

Be concise and conversational. Nicole is the founder — speak to her like a trusted collaborator.`;

const tools = [
  {
    name: 'search_contacts',
    description: 'Full-text search across contacts (name, email, company, bio, transcript, notes). Returns up to 50 matches.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term(s)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'filter_contacts',
    description: 'Filter contacts by various criteria. All filters are optional and combined with AND. Returns up to 100 matches.',
    input_schema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Filter by source (network, client-lead, contractor, videoask, mixed, wix, crowdcast, etc.)' },
        tag: { type: 'string', description: 'Filter by tag' },
        role: { type: 'string', description: 'Filter by role (e.g. Freelancer, Consultant, Investor)' },
        skill: { type: 'string', description: 'Filter by skill (e.g. Marketing, Design, Dev)' },
        interest: { type: 'string', description: 'Filter by interest (partial match)' },
        has_video: { type: 'boolean', description: 'Only contacts with video' },
        has_bio: { type: 'boolean', description: 'Only contacts with a bio' },
        stale_days: { type: 'number', description: 'Contacts not interacted with in this many days' },
        company: { type: 'string', description: 'Filter by company name (partial match)' },
        bio_contains: { type: 'string', description: 'Search within bio text' },
        transcript_contains: { type: 'string', description: 'Search within video transcripts' },
        title: { type: 'string', description: 'Filter by title/role (partial match)' },
        hourly_rate: { type: 'string', description: 'Filter by hourly rate (partial match)' },
        specialty: { type: 'string', description: 'Filter by specialty (partial match in specialties jsonb array)' },
        status: { type: 'string', description: 'Filter by status (e.g. active, inactive, do not use)' },
        limit: { type: 'number', description: 'Max results to return (default 50)' },
      },
    },
  },
  {
    name: 'get_contact_details',
    description: 'Get full details for a specific contact by email or name, including all notes.',
    input_schema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Contact email' },
        name: { type: 'string', description: 'Contact name (partial match)' },
      },
    },
  },
  {
    name: 'get_stats',
    description: 'Get summary statistics about the CRM database.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'run_sql',
    description: 'Run a read-only SQL query against the CRM database for complex queries that other tools cannot handle. Tables: crm_contacts (id, email, first_name, last_name, full_name, company, phone, website, bio, roles jsonb[], skills jsonb[], interests jsonb[], services_needed jsonb[], business_size, client_notes, video_url, video_transcript, video_duration, calendly_completed, hourly_rate, title, specialties jsonb[], sources jsonb[], tags jsonb[], last_interaction_at, created_at, updated_at), crm_notes (id, contact_id, content, note_type, created_at), crm_import_log (id, source_name, file_name, rows_total, rows_imported, rows_merged, rows_skipped, imported_at). Only SELECT queries allowed.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'SQL SELECT query' },
      },
      required: ['query'],
    },
  },
];

async function executeTool(name, input) {
  switch (name) {
    case 'search_contacts': {
      const { data, error } = await supabase
        .from('crm_contacts')
        .select('full_name, email, company, roles, skills, interests, sources, tags, bio, video_url, last_interaction_at, title, hourly_rate, specialties, status')
        .textSearch('search_vector', input.query, { type: 'websearch' })
        .limit(50);
      if (error) return { error: error.message };
      return { count: data.length, contacts: data };
    }

    case 'filter_contacts': {
      let query = supabase
        .from('crm_contacts')
        .select('full_name, email, company, phone, roles, skills, interests, sources, tags, bio, video_url, last_interaction_at, title, hourly_rate, specialties, status');

      if (input.source) query = query.filter('sources', 'cs', `["${input.source}"]`);
      if (input.tag) query = query.filter('tags', 'cs', `["${input.tag}"]`);
      if (input.role) query = query.filter('roles', 'cs', `["${input.role}"]`);
      if (input.skill) query = query.filter('skills', 'cs', `["${input.skill}"]`);
      if (input.interest) query = query.ilike('interests', `%${input.interest}%`);
      if (input.has_video) query = query.not('video_url', 'is', null);
      if (input.has_bio) query = query.not('bio', 'is', null);
      if (input.company) query = query.ilike('company', `%${input.company}%`);
      if (input.bio_contains) query = query.ilike('bio', `%${input.bio_contains}%`);
      if (input.transcript_contains) query = query.ilike('video_transcript', `%${input.transcript_contains}%`);
      if (input.title) query = query.ilike('title', `%${input.title}%`);
      if (input.hourly_rate) query = query.ilike('hourly_rate', `%${input.hourly_rate}%`);
      if (input.specialty) query = query.ilike('specialties::text', `%${input.specialty}%`);
      if (input.status) query = query.ilike('status', `%${input.status}%`);
      if (input.stale_days) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - input.stale_days);
        query = query.or(`last_interaction_at.is.null,last_interaction_at.lt.${cutoff.toISOString()}`);
      }

      query = query.limit(input.limit || 50);

      const { data, error } = await query;
      if (error) return { error: error.message };
      return { count: data.length, contacts: data };
    }

    case 'get_contact_details': {
      let query = supabase.from('crm_contacts').select('*');
      if (input.email) query = query.eq('email', input.email.toLowerCase());
      else if (input.name) query = query.ilike('full_name', `%${input.name}%`);

      const { data: contacts, error } = await query.limit(1);
      if (error) return { error: error.message };
      if (!contacts?.length) return { error: 'Contact not found' };

      const contact = contacts[0];
      const { data: notes } = await supabase
        .from('crm_notes')
        .select('*')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(20);

      return { contact, notes: notes || [] };
    }

    case 'get_stats': {
      const { count: total } = await supabase.from('crm_contacts').select('*', { count: 'exact', head: true });

      const sources = ['network', 'client-lead', 'contractor', 'videoask', 'mixed', 'wix', 'crowdcast'];
      const sourceCounts = {};
      for (const s of sources) {
        const { count } = await supabase.from('crm_contacts').select('*', { count: 'exact', head: true }).filter('sources', 'cs', `["${s}"]`);
        if (count > 0) sourceCounts[s] = count;
      }

      const { count: withVideo } = await supabase.from('crm_contacts').select('*', { count: 'exact', head: true }).not('video_url', 'is', null);
      const { count: withBio } = await supabase.from('crm_contacts').select('*', { count: 'exact', head: true }).not('bio', 'is', null);
      const { count: notesCount } = await supabase.from('crm_notes').select('*', { count: 'exact', head: true });

      return { total, sourceCounts, withVideo, withBio, notesCount };
    }

    case 'run_sql': {
      if (!input.query.trim().toLowerCase().startsWith('select')) {
        return { error: 'Only SELECT queries are allowed' };
      }
      const { data, error } = await supabase.rpc('run_readonly_sql', { sql_query: input.query });
      if (error) {
        // Fallback: try direct query via PostgREST won't work, return error
        return { error: `SQL error: ${error.message}. Try using the other tools instead.` };
      }
      return { data };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function POST(request) {
  const { messages } = await request.json();

  let anthropicMessages = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  // Tool use loop
  let response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools,
    messages: anthropicMessages,
  });

  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
    const toolResults = [];

    for (const block of toolUseBlocks) {
      const result = await executeTool(block.name, block.input);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    anthropicMessages = [
      ...anthropicMessages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults },
    ];

    response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages: anthropicMessages,
    });
  }

  const textBlock = response.content.find(b => b.type === 'text');
  return Response.json({ message: textBlock?.text || 'No response.' });
}
