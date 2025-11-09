-- Database schema for Physics Inspired World Models Smart Security Application
-- This schema stores media captures (images/audio) from multiple users for SLAM reconstruction

-- Create storage bucket for media files (public for Deepgram URL access)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('media-captures', 'media-captures', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create media_captures table
CREATE TABLE IF NOT EXISTS public.media_captures (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'audio', 'video', 'transcript')),
    file_path TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    frame_number INTEGER,
    chunk_number INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_media_captures_session_id ON public.media_captures(session_id);
CREATE INDEX IF NOT EXISTS idx_media_captures_user_id ON public.media_captures(user_id);
CREATE INDEX IF NOT EXISTS idx_media_captures_media_type ON public.media_captures(media_type);
CREATE INDEX IF NOT EXISTS idx_media_captures_timestamp ON public.media_captures(timestamp);
CREATE INDEX IF NOT EXISTS idx_media_captures_frame_number ON public.media_captures(frame_number) WHERE frame_number IS NOT NULL;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_media_captures_updated_at ON public.media_captures;
CREATE TRIGGER trigger_media_captures_updated_at
    BEFORE UPDATE ON public.media_captures
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Row Level Security policies
ALTER TABLE public.media_captures ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own media captures" ON public.media_captures;
DROP POLICY IF EXISTS "Users can insert their own media captures" ON public.media_captures;
DROP POLICY IF EXISTS "Users can update their own media captures" ON public.media_captures;
DROP POLICY IF EXISTS "Users can delete their own media captures" ON public.media_captures;
DROP POLICY IF EXISTS "Users can upload their own media files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own media files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own media files" ON storage.objects;

-- Users can only access their own media captures
CREATE POLICY "Users can view their own media captures" 
    ON public.media_captures FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own media captures" 
    ON public.media_captures FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own media captures" 
    ON public.media_captures FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own media captures" 
    ON public.media_captures FOR DELETE 
    USING (auth.uid() = user_id);

-- Storage policies for media-captures bucket
CREATE POLICY "Users can upload their own media files" 
    ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'media-captures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own media files" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'media-captures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own media files" 
    ON storage.objects FOR DELETE 
    USING (bucket_id = 'media-captures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create session_summary view for analytics
CREATE OR REPLACE VIEW public.session_summary AS
SELECT 
    session_id,
    user_id,
    COUNT(*) as total_captures,
    COUNT(*) FILTER (WHERE media_type = 'image') as image_count,
    COUNT(*) FILTER (WHERE media_type = 'audio') as audio_count,
    MIN(timestamp) as session_start,
    MAX(timestamp) as session_end,
    MAX(timestamp) - MIN(timestamp) as session_duration,
    COUNT(DISTINCT DATE(timestamp)) as recording_days
FROM public.media_captures
GROUP BY session_id, user_id;

-- Grant permissions
GRANT ALL ON public.media_captures TO authenticated;
GRANT ALL ON public.session_summary TO authenticated;
GRANT USAGE ON SEQUENCE public.media_captures_id_seq TO authenticated;

-- Example queries for the vggt SLAM reconstruction app:

-- Get all images from a specific session for processing
-- SELECT file_path, frame_number, timestamp, metadata 
-- FROM media_captures 
-- WHERE session_id = 'session_123' AND media_type = 'image' 
-- ORDER BY frame_number;

-- Get synchronized audio chunks for a session
-- SELECT file_path, chunk_number, timestamp, metadata 
-- FROM media_captures 
-- WHERE session_id = 'session_123' AND media_type = 'audio' 
-- ORDER BY chunk_number;

-- Get transcriptions for a session
-- SELECT metadata->>'transcript' as transcript, chunk_number, timestamp, 
--        metadata->>'confidence' as confidence
-- FROM media_captures 
-- WHERE session_id = 'session_123' AND media_type = 'transcript' 
-- ORDER BY chunk_number;

-- Get complete session data with images, audio, and transcripts
-- SELECT session_id, media_type, COUNT(*) as count, 
--        MIN(timestamp) as first_capture, MAX(timestamp) as last_capture
-- FROM media_captures 
-- WHERE session_id = 'session_123'
-- GROUP BY session_id, media_type;

-- Get all sessions from multiple users for collaborative SLAM
-- SELECT session_id, user_id, session_start, session_end, image_count, audio_count
-- FROM session_summary 
-- WHERE session_start >= NOW() - INTERVAL '1 day'
-- ORDER BY session_start;