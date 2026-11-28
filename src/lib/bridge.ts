import type {SupabaseClient} from '@supabase/supabase-js';
import {createReadOnlyBridge} from './supabase-readonly-adapter.mjs';
import {createSafeWorkflow} from './safe-workflow.mjs';
import {createEventCaseApi} from './event-case-api.mjs';
import {createGuardianLinksApi} from './guardian-links-api.mjs';
export type ClassItem={id:string;name:string;school_year:string;room:string};
export type DelegateItem={class_id:string;duty:string;permissions:string[];name:null};
export type StudentItem={id:string;name:string;student_no:string;class_id?:string;archived_at?:string|null};
export type DossierData={student:{id:string;name:string;student_no:string};sections:Record<string,{items:Record<string,unknown>[];error:string|null}>};
export type AuditItem={id:number;table_name:string;row_id:string;action:string;actor_id:string|null;changed_at:string};
export type Submission={id:string;class_id:string;student_id:string;submitted_by?:string;entry_type:string;occurred_on:string;details:{status?:string;note?:string};status:string;review_note?:string|null;created_at:string};
export function getBridges(client:SupabaseClient){return {reader:createReadOnlyBridge(client),writer:createSafeWorkflow(client),cases:createEventCaseApi(client),guardians:createGuardianLinksApi(client)};}

export type DossierPage={items:Record<string,unknown>[];count:number|null;page:number;pageSize:number};
