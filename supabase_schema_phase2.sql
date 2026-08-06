-- ============================================================
-- CodeAtlas AI — Phase 2 Schema Migration
-- Run this in your Supabase SQL Editor after Phase 1 schema
-- ============================================================

-- 1. Add new columns to existing tables
ALTER TABLE public.repositories ADD COLUMN IF NOT EXISTS commit_activity JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.processing_jobs ADD COLUMN IF NOT EXISTS error_message TEXT;

-- 2. Create repository_files table
CREATE TABLE IF NOT EXISTS public.repository_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID REFERENCES public.repositories(id) ON DELETE CASCADE NOT NULL,
    file_path TEXT NOT NULL,
    language TEXT,
    size_bytes INTEGER DEFAULT 0,
    line_count INTEGER DEFAULT 0,
    imports JSONB DEFAULT '[]'::jsonb,
    parsed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create repository_classes table
CREATE TABLE IF NOT EXISTS public.repository_classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES public.repository_files(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    line_start INTEGER,
    line_end INTEGER,
    docstring TEXT
);

-- 4. Create repository_functions table
CREATE TABLE IF NOT EXISTS public.repository_functions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID REFERENCES public.repository_files(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    parent_class TEXT,
    parameters TEXT,
    line_start INTEGER,
    line_end INTEGER,
    docstring TEXT
);

-- 5. Enable RLS on new tables
ALTER TABLE public.repository_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repository_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repository_functions ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for repository_files (join through repositories → projects → user_id)
DROP POLICY IF EXISTS "Users can manage files for their repositories" ON public.repository_files;
CREATE POLICY "Users can manage files for their repositories" ON public.repository_files
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.repositories r
            JOIN public.projects p ON p.id = r.project_id
            WHERE r.id = repository_files.repository_id AND p.user_id = auth.uid()
        )
    );

-- 7. RLS Policies for repository_classes
DROP POLICY IF EXISTS "Users can manage classes for their repositories" ON public.repository_classes;
CREATE POLICY "Users can manage classes for their repositories" ON public.repository_classes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.repository_files rf
            JOIN public.repositories r ON r.id = rf.repository_id
            JOIN public.projects p ON p.id = r.project_id
            WHERE rf.id = repository_classes.file_id AND p.user_id = auth.uid()
        )
    );

-- 8. RLS Policies for repository_functions
DROP POLICY IF EXISTS "Users can manage functions for their repositories" ON public.repository_functions;
CREATE POLICY "Users can manage functions for their repositories" ON public.repository_functions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.repository_files rf
            JOIN public.repositories r ON r.id = rf.repository_id
            JOIN public.projects p ON p.id = r.project_id
            WHERE rf.id = repository_functions.file_id AND p.user_id = auth.uid()
        )
    );

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_repository_files_repository_id ON public.repository_files(repository_id);
CREATE INDEX IF NOT EXISTS idx_repository_classes_file_id ON public.repository_classes(file_id);
CREATE INDEX IF NOT EXISTS idx_repository_functions_file_id ON public.repository_functions(file_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_project_id ON public.processing_jobs(project_id);
