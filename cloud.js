/* English Wasteland cloud adapter. Child's anonymous login is isolated from parent's login. */
(() => {
  'use strict';
  const cfg = window.EW_CONFIG || {};
  const configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  let modulePromise;
  const clients = new Map();
  const getLib = () => {
    if (!configured) throw new Error('Облачное подключение пока не настроено. См. README.md.');
    if (!modulePromise) modulePromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    return modulePromise;
  };
  async function client(role) {
    if (clients.has(role)) return clients.get(role);
    const { createClient } = await getLib();
    const instance = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { storageKey: `ew-${role}-auth`, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    clients.set(role, instance);
    return instance;
  }
  window.EWCloud = {
    configured,
    async student() { return client('student'); },
    async parent() { return client('parent'); },
    async connectStudent(code) {
      const db = await client('student');
      let { data: { session } } = await db.auth.getSession();
      if (!session) {
        const { error } = await db.auth.signInAnonymously();
        if (error) throw error;
      }
      const { data, error } = await db.rpc('claim_child', { p_code: code.trim().toUpperCase() });
      if (error) throw error;
      localStorage.setItem('ew-child-id', data);
      return data;
    },
    async syncStudent(state) {
      const childId = localStorage.getItem('ew-child-id');
      if (!childId || !configured) return false;
      const db = await client('student');
      const { data: { session } } = await db.auth.getSession();
      if (!session) throw new Error('Сессия ученика закончилась. Снова подключи код.');
      const unsent = (state.attempts || []).filter(x => !x.synced).slice(0, 150);
      if (unsent.length) {
        const rows = unsent.map(a => ({
          id:a.id,child_id:childId,chapter:1,task_id:a.taskId,kind:a.kind,
          word:a.word,skill:a.skill,given_answer:a.given,expected_answer:a.expected,
          correct:a.correct,hint_used:a.hintUsed,created_at:a.at
        }));
        const { error } = await db.from('attempts').upsert(rows, { onConflict: 'id' });
        if (error) throw error;
        const syncedIds = new Set(unsent.map(a => a.id));
        state.attempts.forEach(a => { if(syncedIds.has(a.id)) a.synced = true; });
      }
      const { error } = await db.from('progress').upsert({
        child_id:childId,
        game_state: { ...state, attempts: undefined },
        updated_at: new Date().toISOString()
      }, {onConflict:'child_id'});
      if (error) throw error;
      return true;
    },
    async getRemoteState() {
      const childId = localStorage.getItem('ew-child-id');
      if (!childId || !configured) return null;
      const db = await client('student');
      const {data,error}=await db.from('progress').select('game_state').eq('child_id',childId).maybeSingle();
      if(error)throw error;return data?.game_state||null;
    },
    async getAssignment() {
      const childId = localStorage.getItem('ew-child-id');
      if (!childId || !configured) return null;
      const db = await client('student');
      const { data, error } = await db.from('homework_assignments').select('id,title,words,created_at').eq('child_id',childId).order('created_at',{ascending:false}).limit(1);
      if (error) throw error;
      return data?.[0] || null;
    }
  };
})();
