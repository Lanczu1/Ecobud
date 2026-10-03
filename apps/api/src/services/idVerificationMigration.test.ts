import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { expect, it } from 'vitest';

it('migrates existing residents to not submitted and prevents concurrent pending submissions', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE ecobud_backend;
      CREATE TABLE users (id TEXT PRIMARY KEY); INSERT INTO users VALUES ('resident'), ('moderator');
      CREATE SCHEMA storage; CREATE TABLE storage.objects (bucket_id TEXT, name TEXT);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA storage TO anon, authenticated;
      GRANT SELECT, INSERT, UPDATE ON storage.objects TO anon, authenticated;
      CREATE POLICY client_media ON storage.objects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
      INSERT INTO storage.objects VALUES ('ecobud-media','public'), ('ecobud-private-ids','private');`);
    await db.exec(readFileSync(resolve('prisma/migrations/20261003000000_id_verification/migration.sql'), 'utf8'));
    const { rows } = await db.query<{ id_verification_status: string }>("SELECT id_verification_status FROM users WHERE id='resident'");
    expect(rows[0].id_verification_status).toBe('not_submitted');
    await db.exec("INSERT INTO id_verification_submissions (id,user_id,legal_name,id_type,barangay,document_path) VALUES ('first','resident','Resident Name','school','Yukos','private/first');");
    await expect(db.exec("INSERT INTO id_verification_submissions (id,user_id,legal_name,id_type,barangay) VALUES ('second','resident','Resident Name','school','Yukos');")).rejects.toThrow();
    await db.exec("UPDATE id_verification_submissions SET status='rejected',reason='Unreadable',reviewer_id='moderator',reviewed_at=CURRENT_TIMESTAMP WHERE id='first'; INSERT INTO id_verification_submissions (id,user_id,legal_name,id_type,barangay) VALUES ('second','resident','Resident Name','school','Yukos');");
    const history = await db.query<{ status: string; reason: string | null }>('SELECT status,reason FROM id_verification_submissions ORDER BY id');
    expect(history.rows).toEqual([{ status: 'rejected', reason: 'Unreadable' }, { status: 'pending', reason: null }]);
    await db.exec('GRANT SELECT, INSERT, UPDATE ON users TO authenticated; SET ROLE authenticated;');
    await expect(db.exec('SELECT * FROM id_verification_submissions')).rejects.toThrow();
    expect((await db.query<{ name: string }>('SELECT name FROM storage.objects')).rows).toEqual([{ name: 'public' }]);
    await expect(db.exec("INSERT INTO storage.objects VALUES ('ecobud-private-ids','malicious')")).rejects.toThrow();
    await expect(db.exec("UPDATE users SET id_verification_status='approved' WHERE id='resident'")).rejects.toThrow('ID status is managed');
    await expect(db.exec("INSERT INTO users(id,id_verification_status) VALUES ('fake','approved')")).rejects.toThrow('ID status is managed');
    await db.exec('RESET ROLE; SET ROLE ecobud_backend;');
    expect((await db.query<{ count: number }>('SELECT count(*)::int AS count FROM id_verification_submissions')).rows[0].count).toBe(2);
    await db.exec('RESET ROLE;');
  } finally { await db.close(); }
}, 30000);
