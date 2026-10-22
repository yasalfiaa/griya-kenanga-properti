import * as fs from 'fs';
import * as path from 'path';

const schema = fs.readFileSync(path.resolve('supabase/migrations/01_schema.sql'), 'utf8');
const functions = fs.readFileSync(path.resolve('supabase/migrations/02_functions_triggers.sql'), 'utf8');
const rls = fs.readFileSync(path.resolve('supabase/migrations/03_rls.sql'), 'utf8');
const seed = fs.readFileSync(path.resolve('supabase/seed.sql'), 'utf8');

const storageSql = `
-- ====================================================================
-- BUCKET STORAGE PRIVAT (PRD Bagian 8 & 10 butir 4)
-- ====================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('ktp', 'ktp', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('bukti_transfer', 'bukti_transfer', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('laporan_kerusakan', 'laporan_kerusakan', false) ON CONFLICT (id) DO NOTHING;
`;

const masterSql = `-- ====================================================================
-- MASTER SETUP: GRIYA KENANGA RESIDENCE
-- Salin dan jalankan seluruh isi file ini di Supabase SQL Editor
-- (https://supabase.com/dashboard/project/zhkbjggeltzrosbrpyxn/sql/new)
-- ====================================================================

${schema}

${functions}

${rls}

${storageSql}

${seed}
`;

fs.writeFileSync(path.resolve('supabase/FULL_SETUP.sql'), masterSql, 'utf8');
console.log('Master SQL file generated at supabase/FULL_SETUP.sql');
