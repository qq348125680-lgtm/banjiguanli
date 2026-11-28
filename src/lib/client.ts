import {createClient, type SupabaseClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL?.trim();
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const configured=Boolean(url&&key&&!url.includes('YOUR_PROJECT')&&!key.includes('YOUR_PUBLIC'));
// Frontend switch is NOT authorization: RLS and atomic database transactions
// remain mandatory. Require two independent, deliberate build acknowledgements
// so accidentally setting a single flag cannot expose unfinished write paths.
const workflowWritesRequested=import.meta.env.VITE_ENABLE_WORKFLOW_WRITES==='true';
const writeGateAcknowledged=import.meta.env.VITE_V7_WRITE_GATE_ACKNOWLEDGED==='true';
export const writesEnabled=Boolean(configured&&workflowWritesRequested&&writeGateAcknowledged);
export const client:SupabaseClient|null=configured?createClient(url!,key!,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
