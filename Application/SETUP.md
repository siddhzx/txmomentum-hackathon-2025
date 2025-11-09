# Smart Security Recording Setup

## 🚀 Quick Setup

### 1. Database Setup
Run the SQL in `database-schema.sql` in your Supabase SQL editor:
```sql
-- This creates the media_captures table and storage policies
-- Copy and paste the entire database-schema.sql file into Supabase SQL editor
```

### 2. Environment Variables
Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

Fill in your credentials:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key
- `VITE_DEEPGRAM_API_KEY`: Get from [Deepgram Console](https://console.deepgram.com/)

### 3. Create Storage Bucket
In Supabase Dashboard → Storage → Create bucket:
- Name: `media-captures`
- Public: `false` (private bucket)

### 4. Test the App
```bash
npm run dev
```

## 🎯 How It Works

### After Google Login:
1. **Camera Permission** - Automatically requests camera/audio access
2. **Frame Capture** - Captures video frames every 500ms
3. **Audio Recording** - Records 1-second audio chunks
4. **Real-time Speech-to-Text** - Streams audio to Deepgram WebSocket for live transcription
5. **Supabase Storage** - Saves everything to your database

### Console Output
Watch your browser console for real-time logging:
- 📸 Frame captures
- 🎵 Audio uploads  
- 🔌 Deepgram WebSocket connection
- ✅ Real-time transcriptions
- 💾 Database saves
- ❌ Error handling

### Data Structure
All media is saved with:
- **Session ID** for grouping
- **User ID** for multi-user support
- **Timestamps** for synchronization
- **Metadata** for SLAM reconstruction

### For Your VGGT SLAM App
Query synchronized data:
```sql
-- Get all images from a session
SELECT file_path, frame_number, timestamp 
FROM media_captures 
WHERE session_id = 'session_xxx' AND media_type = 'image' 
ORDER BY frame_number;

-- Get transcriptions
SELECT metadata->>'transcript' as text, timestamp
FROM media_captures 
WHERE session_id = 'session_xxx' AND media_type = 'transcript' 
ORDER BY chunk_number;
```

## 🔧 Troubleshooting

### Storage Upload Errors
If you see "row-level security policy" errors:
1. Make sure you ran the complete `database-schema.sql`
2. Check that the `media-captures` bucket exists
3. Verify your user is authenticated

### Deepgram Errors
If transcriptions aren't working:
1. Check your API key in `.env`
2. Verify you have Deepgram credits
3. Check browser console for detailed errors

### Camera Permission Issues
- Allow camera/microphone when prompted
- Use HTTPS (required for camera access)
- Check browser settings if permission was denied

## 📊 What Gets Stored

### In Supabase Storage (`media-captures` bucket):
```
user-id/
├── session-1/
│   ├── frame_0_timestamp.jpg
│   ├── frame_1_timestamp.jpg
│   ├── audio_0_timestamp.webm
│   └── audio_1_timestamp.webm
└── session-2/
    └── ...
```

### In Database (`media_captures` table):
- Images with frame numbers
- Audio chunks with timestamps
- Transcriptions with confidence scores
- Session metadata for multi-user sync

Perfect for physics-inspired world model reconstruction! 🌍