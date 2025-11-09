import { Link } from '@tanstack/react-router'
import { ArrowRight, Shield, Users, Zap, Camera, Mic, Database, Settings, Eye, Box } from 'lucide-react'
import { useSupabaseAuth } from '../auth/supabase'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../utils/supabase'
import { vggtService } from '../services/VGGTService'

export default function HomePage() {
  const auth = useSupabaseAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<'pending' | 'granted' | 'denied'>('pending')
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
  const [capturedFrames, setCapturedFrames] = useState(0)
  const [savedToSupabase, setSavedToSupabase] = useState(0)
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
  
  // VGGT 3D Reconstruction State
  const [vggtProcessed, setVggtProcessed] = useState(0)
  const [vggtReconstructions, setVggtReconstructions] = useState<any[]>([])
  const [isVggtEnabled, setIsVggtEnabled] = useState(true)
  const [vggtStatus, setVggtStatus] = useState<'idle' | 'processing' | 'error'>('idle')

  useEffect(() => {
    if (auth.isAuthenticated && permissionStatus === 'pending') {
      requestCameraPermissions()
    }
  }, [auth.isAuthenticated, permissionStatus])

  // Initialize VGGT service
  useEffect(() => {
    if (auth.isAuthenticated && sessionId) {
      vggtService.initialize(sessionId)
      vggtService.onReconstruction((result) => {
        console.log('🎯 VGGT reconstruction completed:', result.frameCount, 'frames')
        setVggtReconstructions(prev => [...prev, result])
        setVggtProcessed(prev => prev + 1)
        setVggtStatus('idle')
      })
    }
  }, [auth.isAuthenticated, sessionId])

  useEffect(() => {
    console.log('Session ID:', sessionId)
    console.log('User:', auth.user?.email)
    console.log('Recording Status:', isRecording)
    console.log('Captured Frames:', capturedFrames)
    console.log('Saved to Supabase:', savedToSupabase)
    console.log('VGGT Processed:', vggtProcessed)
  }, [sessionId, auth.user?.email, isRecording, capturedFrames, savedToSupabase, vggtProcessed])

  const requestCameraPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      
      setPermissionStatus('granted')
      startRecording(stream)
    } catch (error) {
      console.error('Error accessing camera:', error)
      setPermissionStatus('denied')
    }
  }

  const captureFrame = async (): Promise<Blob | null> => {
    if (!videoRef.current || !canvasRef.current) return null
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    ctx.drawImage(videoRef.current, 0, 0)
    
    return new Promise(resolve => {
      canvas.toBlob(resolve, 'image/jpeg', 0.8)
    })
  }

  const saveFrameToSupabase = async (frameBlob: Blob, frameNumber: number) => {
    try {
      const timestamp = Date.now()
      const fileName = `${auth.user?.id}/${sessionId}/frame_${frameNumber}_${timestamp}.jpg`
      
      console.log('📤 Uploading frame:', fileName)
      
      const { data, error } = await supabase.storage
        .from('media-captures')
        .upload(fileName, frameBlob, {
          contentType: 'image/jpeg',
          upsert: false
        })
      
      if (error) {
        console.error('❌ Frame upload error:', error)
        return null
      }
      
      console.log('✅ Frame uploaded:', data.path)
      
      // Save metadata to database
      const { error: dbError } = await supabase
        .from('media_captures')
        .insert({
          session_id: sessionId,
          user_id: auth.user?.id,
          media_type: 'image',
          file_path: data.path,
          timestamp: new Date(timestamp).toISOString(),
          frame_number: frameNumber,
          metadata: {
            width: canvasRef.current?.width,
            height: canvasRef.current?.height,
            user_email: auth.user?.email
          }
        })
      
      if (dbError) {
        console.error('❌ Database insert error:', dbError)
      } else {
        console.log('✅ Frame metadata saved to database')
        setSavedToSupabase(prev => prev + 1)
        
        // Send frame to VGGT for 3D reconstruction
        if (isVggtEnabled) {
          setVggtStatus('processing')
          try {
            await vggtService.addFrame(sessionId, frameNumber, data.path)
            console.log('🔬 Frame sent to VGGT for processing:', frameNumber)
          } catch (error) {
            console.error('❌ VGGT processing error:', error)
            setVggtStatus('error')
          }
        }
      }
      
      return data.path
    } catch (error) {
      console.error('❌ Save frame error:', error)
      return null
    }
  }

  const saveAudioChunkToSupabase = async (audioBlob: Blob, chunkNumber: number) => {
    try {
      const timestamp = Date.now()
      const fileName = `${auth.user?.id}/${sessionId}/audio_${chunkNumber}_${timestamp}.webm`
      
      console.log('🎵 Uploading audio chunk:', fileName)
      
      const { data, error } = await supabase.storage
        .from('media-captures')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        })
      
      if (error) {
        console.error('❌ Audio upload error:', error)
        return null
      }
      
      console.log('✅ Audio uploaded:', data.path)
      
      // Save metadata to database
      const { error: dbError } = await supabase
        .from('media_captures')
        .insert({
          session_id: sessionId,
          user_id: auth.user?.id,
          media_type: 'audio',
          file_path: data.path,
          timestamp: new Date(timestamp).toISOString(),
          chunk_number: chunkNumber,
          metadata: {
            size: audioBlob.size,
            type: audioBlob.type,
            user_email: auth.user?.email
          }
        })
      
      if (dbError) {
        console.error('❌ Database insert error:', dbError)
      } else {
        console.log('✅ Audio metadata saved to database')
        setSavedToSupabase(prev => prev + 1)
      }
      
      return data.path
    } catch (error) {
      console.error('❌ Save audio error:', error)
      return null
    }
  }


  const startRecording = (stream: MediaStream) => {
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
    })
    
    mediaRecorderRef.current = mediaRecorder
    setRecordedChunks([])
    setCapturedFrames(0)
    setSavedToSupabase(0)

    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        console.log('🎬 New audio/video chunk received:', event.data.size, 'bytes')
        const currentChunkNumber = recordedChunks.length
        setRecordedChunks(prev => [...prev, event.data])
        
        // Save audio chunk to Supabase
        await saveAudioChunkToSupabase(event.data, currentChunkNumber)
      }
    }

    mediaRecorder.start(1000) // Record in 1-second chunks
    setIsRecording(true)
    
    // Start capturing frames every 500ms
    frameIntervalRef.current = setInterval(async () => {
      const frameBlob = await captureFrame()
      if (frameBlob) {
        const frameNumber = capturedFrames
        setCapturedFrames(prev => prev + 1)
        console.log('📸 Captured frame:', frameNumber)
        
        // Save frame to Supabase
        await saveFrameToSupabase(frameBlob, frameNumber)
      }
    }, 500)
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      // Stop frame capture interval
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current)
        frameIntervalRef.current = null
      }
      
      // Stop all tracks
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
      }
      
      console.log('🛑 Recording stopped. Total frames captured:', capturedFrames)
      console.log('💾 Total items saved to Supabase:', savedToSupabase)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: '#f0f2f5' }}>
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-6xl md:text-7xl font-bold mb-6" style={{ 
              color: '#344767',
              letterSpacing: '-0.02em',
              lineHeight: '1.2',
              fontWeight: 500
            }}>
              <span className="text-transparent bg-clip-text bg-gradient-to-r" style={{
                backgroundImage: 'linear-gradient(195deg, #0066FF 0%, #FF6B6B 100%)',
                fontWeight: 300
              }}>
                {' '}
                hzx.ai
              </span>
            </h1>
            <p className="text-xl mb-8 max-w-3xl mx-auto" style={{ 
              color: '#7b809a',
              lineHeight: '1.625',
              fontWeight: 300
            }}>
              Physics Inspired World Models for Smart Security Applications. We build world environments that are domain extensible across denied encrypted environments like healthcare, defense, and education.
              <b>Ontology enables breakthrough applications with production-ready deployment.</b> 
            </p>
            
            {!auth.isAuthenticated ? (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link 
                  to="/login" 
                  search={{ redirect: '/' }}
                  className="inline-flex items-center px-8 py-3 border border-transparent text-base font-semibold rounded-xl text-white transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                  style={{
                    background: 'linear-gradient(135deg, #0066FF 0%, #4D8AFF 100%)',
                    letterSpacing: '-0.01em'
                  }}
                >
                  Get Started
                  <ArrowRight size={20} className="ml-2" />
                </Link>
                <button type="button" className="inline-flex items-center px-8 py-3 border text-base font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1" style={{
                  borderColor: '#E2E8F0',
                  color: '#4A5568',
                  backgroundColor: '#FFFFFF',
                  letterSpacing: '-0.01em'
                }}>
                  Learn More
                </button>
              </div>
            ) : (
              <div style={{
                background: 'linear-gradient(195deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 1))',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                padding: '32px',
                maxWidth: '1024px',
                margin: '0 auto',
                border: 'none'
              }}>
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold mb-2" style={{ 
                    color: '#344767',
                    fontWeight: 700
                  }}>
                    Smart Security Recording
                  </h2>
                  <p className="mb-4" style={{ 
                    color: '#7b809a',
                    fontWeight: 300
                  }}>
                    Signed in as {auth.user?.email}
                  </p>
                  
                  {permissionStatus === 'pending' && (
                    <div className="flex items-center justify-center space-x-2 text-blue-600">
                      <Camera className="w-5 h-5 animate-pulse" />
                      <span>Requesting camera permissions...</span>
                    </div>
                  )}
                  
                  {permissionStatus === 'denied' && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                      <div className="flex items-center space-x-2 text-red-700">
                        <Camera className="w-5 h-5" />
                        <span>Camera access denied. Please enable camera permissions and refresh.</span>
                      </div>
                      <button
                        type="button"
                        onClick={requestCameraPermissions}
                        className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  )}
                  
                  {permissionStatus === 'granted' && (
                    <div className="space-y-4">
                      <div className="relative bg-black rounded-lg overflow-hidden">
                        <video
                          ref={videoRef}
                          autoPlay
                          muted
                          playsInline
                          className="w-full h-64 object-cover"
                        />
                        <canvas ref={canvasRef} className="hidden" />
                        {isRecording && (
                          <div className="absolute top-4 left-4 flex items-center space-x-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                            <span>Recording</span>
                          </div>
                        )}
                        {isRecording && (
                          <div className="absolute top-4 right-4 flex items-center space-x-2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm">
                            <Database className="w-3 h-3" />
                            <span>{savedToSupabase} saved</span>
                          </div>
                        )}
                        {isRecording && isVggtEnabled && (
                          <div className="absolute bottom-4 right-4 flex items-center space-x-2 bg-purple-600 text-white px-3 py-1 rounded-full text-sm">
                            {vggtStatus === 'processing' ? (
                              <div className="w-3 h-3 bg-white rounded-full animate-spin"></div>
                            ) : vggtStatus === 'error' ? (
                              <div className="w-3 h-3 bg-red-300 rounded-full"></div>
                            ) : (
                              <Box className="w-3 h-3" />
                            )}
                            <span>VGGT: {vggtProcessed}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-center space-x-6">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Camera className="w-4 h-4" />
                          <span>Frames: {capturedFrames}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Mic className="w-4 h-4" />
                          <span>Audio: {recordedChunks.length}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Database className="w-4 h-4" />
                          <span>Saved: {savedToSupabase}</span>
                        </div>
                        {isVggtEnabled && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Box className="w-4 h-4" />
                            <span>3D: {vggtProcessed}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex space-x-3">
                        {!isRecording ? (
                          <button
                            type="button"
                            onClick={() => requestCameraPermissions()}
                            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center space-x-2"
                          >
                            <Camera className="w-5 h-5" />
                            <span>Start Recording</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={stopRecording}
                            className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center space-x-2"
                          >
                            <div className="w-4 h-4 bg-white rounded-sm"></div>
                            <span>Stop Recording</span>
                          </button>
                        )}
                        
                        <button
                          type="button"
                          onClick={() => setIsVggtEnabled(!isVggtEnabled)}
                          className={`px-4 py-3 rounded-lg transition-colors font-medium flex items-center space-x-2 ${
                            isVggtEnabled 
                              ? 'bg-purple-600 text-white hover:bg-purple-700' 
                              : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                          }`}
                        >
                          <Box className="w-4 h-4" />
                          <span>VGGT</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => auth.logout()}
                          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                        >
                          Sign Out
                        </button>
                      </div>
                      
                      {(recordedChunks.length > 0 || capturedFrames > 0) && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-green-700">
                              <Shield className="w-5 h-5" />
                              <span>Session: {sessionId}</span>
                            </div>
                            <div className="text-sm text-green-600">
                              {capturedFrames} frames + {recordedChunks.length} audio chunks = {savedToSupabase} saved
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {isVggtEnabled && vggtReconstructions.length > 0 && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2 text-purple-700">
                              <Box className="w-5 h-5" />
                              <span>VGGT 3D Reconstruction</span>
                            </div>
                            <div className="text-sm text-purple-600">
                              {vggtProcessed} reconstructions completed
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-purple-600">Latest: </span>
                              <span className="text-purple-800 font-medium">
                                {vggtReconstructions[vggtReconstructions.length - 1]?.frameCount || 0} frames
                              </span>
                            </div>
                            <div>
                              <span className="text-purple-600">Status: </span>
                              <span className={`font-medium ${
                                vggtStatus === 'processing' ? 'text-blue-600' : 
                                vggtStatus === 'error' ? 'text-red-600' : 'text-green-600'
                              }`}>
                                {vggtStatus === 'processing' ? 'Processing...' : 
                                 vggtStatus === 'error' ? 'Error' : 'Ready'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3 flex space-x-2">
                            <a 
                              href="http://localhost:8080" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-3 py-1 bg-purple-600 text-white text-xs rounded-full hover:bg-purple-700 transition-colors"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              View 3D
                            </a>
                            <button
                              type="button"
                              onClick={() => vggtService.forceProcess()}
                              className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 text-xs rounded-full hover:bg-purple-200 transition-colors"
                              disabled={vggtStatus === 'processing'}
                            >
                              <Zap className="w-3 h-3 mr-1" />
                              Force Process
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Embedded Presentation Section */}
      <div className="py-20" style={{ background: '#f8fafc' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ 
              color: '#344767',
              letterSpacing: '-0.01em',
              fontWeight: 700
            }}>
              Project Overview
            </h2>
            <p className="text-xl max-w-3xl mx-auto mb-8" style={{ 
              color: '#7b809a', 
              fontWeight: 300,
              lineHeight: '1.625'
            }}>
              Discover how HZX.AI revolutionizes real-time 3D reconstruction with breakthrough VGGT technology
            </p>
            
            <div className="flex justify-center">
              <div style={{
                background: 'linear-gradient(195deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 1))',
                backdropFilter: 'blur(10px)',
                borderRadius: '20px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                padding: '24px',
                border: 'none',
                maxWidth: '100%'
              }}>
                <iframe 
                  src="https://gamma.app/embed/n7z9pxa0bm4s9sy" 
                  style={{ 
                    width: '700px', 
                    maxWidth: '100%', 
                    height: '450px',
                    borderRadius: '12px',
                    border: 'none'
                  }} 
                  allow="fullscreen" 
                  title="HZX.AI: Real-Time 3D Reconstruction"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VGGT Explanation Section */}
      <div className="py-20" style={{ background: '#FFFFFF' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ 
              color: '#344767',
              letterSpacing: '-0.01em',
              fontWeight: 700
            }}>
              VGGT 3D Reconstruction Engine
            </h2>
            <p className="text-xl max-w-4xl mx-auto" style={{ 
              color: '#7b809a', 
              fontWeight: 300,
              lineHeight: '1.625'
            }}>
              Ontology directly infers all key 3D attributes from images: camera poses, depth maps, point clouds, and 3D tracking - 
              all from one image to hundreds of views, processed within seconds on consumer hardware.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-4" style={{ 
                  color: '#344767',
                  fontWeight: 700
                }}>
                  Feed-Forward Neural Architecture
                </h3>
                <p style={{ 
                  color: '#7b809a', 
                  lineHeight: '1.625',
                  fontWeight: 300,
                  marginBottom: '1rem'
                }}>
                  Built on breakthrough Vision Transformer architecture with alternating attention mechanisms. 
                  Ontology processes multiple views simultaneously using DINOv2 backbone and specialized heads for 
                  camera estimation, depth prediction, and 3D point tracking.
                </p>
                <p style={{ 
                  color: '#7b809a', 
                  lineHeight: '1.625',
                  fontWeight: 300
                }}>
                  **Runtime Performance**: 0.04s for single image, 3.12s for 100 images on H100 GPU. 
                  Trained on massive multi-view datasets with billions of real-world image sequences.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg" style={{
                  background: 'linear-gradient(195deg, rgba(0, 102, 255, 0.1), rgba(0, 102, 255, 0.05))'
                }}>
                  <h4 className="font-semibold mb-2" style={{ color: '#344767' }}>Camera Head</h4>
                  <p className="text-sm" style={{ color: '#7b809a', fontWeight: 300 }}>
                    Pose encoding to extrinsic/intrinsic matrices with L1 loss optimization
                  </p>
                </div>
                <div className="p-4 rounded-lg" style={{
                  background: 'linear-gradient(195deg, rgba(255, 107, 107, 0.1), rgba(255, 107, 107, 0.05))'
                }}>
                  <h4 className="font-semibold mb-2" style={{ color: '#344767' }}>Depth Head</h4>
                  <p className="text-sm" style={{ color: '#7b809a', fontWeight: 300 }}>
                    DPT-based depth estimation with exponential activation and confidence scoring
                  </p>
                </div>
                <div className="p-4 rounded-lg" style={{
                  background: 'linear-gradient(195deg, rgba(76, 175, 80, 0.1), rgba(76, 175, 80, 0.05))'
                }}>
                  <h4 className="font-semibold mb-2" style={{ color: '#344767' }}>Point Head</h4>
                  <p className="text-sm" style={{ color: '#7b809a', fontWeight: 300 }}>
                    Direct 3D point cloud prediction with inverse logarithmic depth encoding
                  </p>
                </div>
                <div className="p-4 rounded-lg" style={{
                  background: 'linear-gradient(195deg, rgba(26, 115, 232, 0.1), rgba(26, 115, 232, 0.05))'
                }}>
                  <h4 className="font-semibold mb-2" style={{ color: '#344767' }}>Track Head</h4>
                  <p className="text-sm" style={{ color: '#7b809a', fontWeight: 300 }}>
                    Query-based 3D point tracking with visibility and confidence estimation
                  </p>
                </div>
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(195deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 1))',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              padding: '32px',
              border: 'none'
            }}>
              <h3 className="text-xl font-bold mb-6" style={{ 
                color: '#344767',
                fontWeight: 700
              }}>
                Research-Grade Performance
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center mt-1" style={{
                    background: 'linear-gradient(195deg, #0066FF, #4D8AFF)'
                  }}>
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <div>
                    <h4 className="font-semibold" style={{ color: '#344767' }}>Research-Grade Quality</h4>
                    <p className="text-sm" style={{ color: '#7b809a', fontWeight: 300 }}>
                      State-of-the-art breakthrough research implementation in computer vision
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center mt-1" style={{
                    background: 'linear-gradient(195deg, #FF6B6B, #FF9999)'
                  }}>
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <div>
                    <h4 className="font-semibold" style={{ color: '#344767' }}>Production Ready</h4>
                    <p className="text-sm" style={{ color: '#7b809a', fontWeight: 300 }}>
                      Commercial-use license available, integrated with Gaussian Splatting and NeRF pipelines
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center mt-1" style={{
                    background: 'linear-gradient(195deg, #4CAF50, #66BB6A)'
                  }}>
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <div>
                    <h4 className="font-semibold" style={{ color: '#344767' }}>COLMAP Export</h4>
                    <p className="text-sm" style={{ color: '#7b809a', fontWeight: 300 }}>
                      Direct integration with industry-standard Structure-from-Motion pipelines
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center mt-1" style={{
                    background: 'linear-gradient(195deg, #1A73E8, #49a3f1)'
                  }}>
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <div>
                    <h4 className="font-semibold" style={{ color: '#344767' }}>Zero-Shot Single View</h4>
                    <p className="text-sm" style={{ color: '#7b809a', fontWeight: 300 }}>
                      Competitive with DepthAnything v2 despite never training on single-image tasks
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Use Cases Section */}
      <div className="py-20" style={{ background: '#f0f2f5' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ 
              color: '#344767',
              letterSpacing: '-0.01em',
              fontWeight: 700
            }}>
              Real-World Applications
            </h2>
            <p className="text-xl max-w-3xl mx-auto" style={{ 
              color: '#7b809a', 
              fontWeight: 300,
              lineHeight: '1.625'
            }}>
              Ontology's versatile 3D reconstruction capabilities enable breakthrough applications across industries
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div style={{
              background: 'linear-gradient(195deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 1))',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              padding: '32px',
              border: 'none',
              position: 'relative'
            }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 relative" style={{
                background: 'linear-gradient(195deg, #0066FF, #4D8AFF)',
                boxShadow: '0 4px 20px 0 rgba(0, 102, 255, 0.14), 0 7px 10px -5px rgba(0, 102, 255, 0.4)',
                marginTop: '-48px',
                zIndex: 1
              }}>
                <Database className="w-8 h-8" style={{ color: '#FFFFFF' }} />
              </div>
              <h3 className="text-xl font-bold mb-4" style={{ 
                color: '#344767',
                fontWeight: 700
              }}>Gaussian Splatting Pipeline</h3>
              <p style={{ color: '#7b809a', lineHeight: '1.625', fontWeight: 300, marginBottom: '1rem' }}>
                Direct COLMAP output integration with gsplat for real-time Neural Radiance Fields. 
                Ontology provides accurate camera poses and 3D points for high-quality view synthesis.
              </p>
              <ul className="text-sm space-y-2">
                <li className="flex items-center" style={{ color: '#7b809a' }}>
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></div>
                  COLMAP format export
                </li>
                <li className="flex items-center" style={{ color: '#7b809a' }}>
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></div>
                  Bundle adjustment support
                </li>
                <li className="flex items-center" style={{ color: '#7b809a' }}>
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></div>
                  Real-time rendering
                </li>
              </ul>
            </div>

            <div style={{
              background: 'linear-gradient(195deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 1))',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              padding: '32px',
              border: 'none',
              position: 'relative'
            }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 relative" style={{
                background: 'linear-gradient(195deg, #FF6B6B, #FF9999)',
                boxShadow: '0 4px 20px 0 rgba(255, 107, 107, 0.14), 0 7px 10px -5px rgba(255, 107, 107, 0.4)',
                marginTop: '-48px',
                zIndex: 1
              }}>
                <Users className="w-8 h-8" style={{ color: '#FFFFFF' }} />
              </div>
              <h3 className="text-xl font-bold mb-4" style={{ 
                color: '#344767',
                fontWeight: 700
              }}>Robotics & AR/VR</h3>
              <p style={{ color: '#7b809a', lineHeight: '1.625', fontWeight: 300, marginBottom: '1rem' }}>
                Real-time 3D scene understanding for autonomous navigation and immersive experiences. 
                Ontology enables robots to understand spatial relationships and track objects in complex environments.
              </p>
              <ul className="text-sm space-y-2">
                <li className="flex items-center" style={{ color: '#7b809a' }}>
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></div>
                  SLAM integration
                </li>
                <li className="flex items-center" style={{ color: '#7b809a' }}>
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></div>
                  Object tracking
                </li>
                <li className="flex items-center" style={{ color: '#7b809a' }}>
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></div>
                  Depth estimation
                </li>
              </ul>
            </div>

            <div style={{
              background: 'linear-gradient(195deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 1))',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              padding: '32px',
              border: 'none',
              position: 'relative'
            }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6 relative" style={{
                background: 'linear-gradient(195deg, #4CAF50, #66BB6A)',
                boxShadow: '0 4px 20px 0 rgba(76, 175, 80, 0.14), 0 7px 10px -5px rgba(76, 175, 80, 0.4)',
                marginTop: '-48px',
                zIndex: 1
              }}>
                <Settings className="w-8 h-8" style={{ color: '#FFFFFF' }} />
              </div>
              <h3 className="text-xl font-bold mb-4" style={{ 
                color: '#344767',
                fontWeight: 700
              }}>Content Creation</h3>
              <p style={{ color: '#7b809a', lineHeight: '1.625', fontWeight: 300, marginBottom: '1rem' }}>
                Single-view to multi-view 3D asset generation for games, films, and virtual production. 
                Ontology excels at zero-shot reconstruction from minimal input data.
              </p>
              <ul className="text-sm space-y-2">
                <li className="flex items-center" style={{ color: '#7b809a' }}>
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></div>
                  Asset generation
                </li>
                <li className="flex items-center" style={{ color: '#7b809a' }}>
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></div>
                  Virtual production
                </li>
                <li className="flex items-center" style={{ color: '#7b809a' }}>
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></div>
                  Photogrammetry
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-16 text-center">
            <div style={{
              background: 'linear-gradient(195deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 1))',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              padding: '48px 32px',
              border: 'none',
              maxWidth: '800px',
              margin: '0 auto'
            }}>
              <h3 className="text-2xl font-bold mb-4" style={{ 
                color: '#344767',
                fontWeight: 700
              }}>
                Open Source + Commercial License
              </h3>
              <p style={{ 
                color: '#7b809a', 
                lineHeight: '1.625',
                fontWeight: 300,
                marginBottom: '1.5rem'
              }}>
                Complete Ontology implementation with state-of-the-art 3D reconstruction capabilities. 
                Commercial license available for production deployment with enterprise-grade performance.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
                <div>
                  <div className="text-2xl font-bold" style={{ color: '#0066FF' }}>1B</div>
                  <div className="text-sm" style={{ color: '#7b809a' }}>Parameters</div>
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: '#FF6B6B' }}>518px</div>
                  <div className="text-sm" style={{ color: '#7b809a' }}>Input Size</div>
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: '#4CAF50' }}>200</div>
                  <div className="text-sm" style={{ color: '#7b809a' }}>Max Images</div>
                </div>
                <div>
                  <div className="text-2xl font-bold" style={{ color: '#1A73E8' }}>H100</div>
                  <div className="text-sm" style={{ color: '#7b809a' }}>GPU Ready</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ 
              color: '#344767',
              letterSpacing: '-0.01em',
              fontWeight: 700
            }}>
              Architecture Deep Dive
            </h2>
            <p className="text-xl" style={{ 
              color: '#7b809a', 
              fontWeight: 300,
              lineHeight: '1.625'
            }}>
              Alternating attention mechanisms and specialized prediction heads enable feed-forward 3D understanding
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-8 transition-all duration-200" style={{
              background: 'linear-gradient(195deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 1))',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              border: 'none',
              position: 'relative'
            }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 relative" style={{
                background: 'linear-gradient(195deg, #0066FF, #4D8AFF)',
                boxShadow: '0 4px 20px 0 rgba(0, 102, 255, 0.14), 0 7px 10px -5px rgba(0, 102, 255, 0.4)',
                marginTop: '-32px',
                zIndex: 1
              }}>
                <Zap className="w-8 h-8" style={{ color: '#FFFFFF' }} />
              </div>
              <h3 className="text-2xl font-bold mb-4" style={{ 
                color: '#344767',
                fontWeight: 700
              }}>Alternating Attention</h3>
              <p style={{ color: '#7b809a', lineHeight: '1.625', fontWeight: 300 }}>
                Frame-wise and global attention blocks process multi-view data with rotary position embeddings and DINOv2 features.
              </p>
            </div>

            <div className="text-center p-8 transition-all duration-200" style={{
              background: 'linear-gradient(195deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 1))',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              border: 'none',
              position: 'relative'
            }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 relative" style={{
                background: 'linear-gradient(195deg, #FF6B6B, #FF9999)',
                boxShadow: '0 4px 20px 0 rgba(255, 107, 107, 0.14), 0 7px 10px -5px rgba(255, 107, 107, 0.4)',
                marginTop: '-32px',
                zIndex: 1
              }}>
                <Shield className="w-8 h-8" style={{ color: '#FFFFFF' }} />
              </div>
              <h3 className="text-2xl font-bold mb-4" style={{ 
                color: '#344767',
                fontWeight: 700
              }}>Multi-Task Heads</h3>
              <p style={{ color: '#7b809a', lineHeight: '1.625', fontWeight: 300 }}>
                Specialized networks for camera pose estimation, depth prediction, 3D points, and tracking with unified training.
              </p>
            </div>

            <div className="text-center p-8 transition-all duration-200" style={{
              background: 'linear-gradient(195deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 1))',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              border: 'none',
              position: 'relative'
            }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 relative" style={{
                background: 'linear-gradient(195deg, #4CAF50, #66BB6A)',
                boxShadow: '0 4px 20px 0 rgba(76, 175, 80, 0.14), 0 7px 10px -5px rgba(76, 175, 80, 0.4)',
                marginTop: '-32px',
                zIndex: 1
              }}>
                <Users className="w-8 h-8" style={{ color: '#FFFFFF' }} />
              </div>
              <h3 className="text-2xl font-bold mb-4" style={{ 
                color: '#344767',
                fontWeight: 700
              }}>Multi-View Training</h3>
              <p style={{ color: '#7b809a', lineHeight: '1.625', fontWeight: 300 }}>
                Trained on massive multi-view datasets with AdamW optimization, gradient clipping, and mixed precision training.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Benchmarks Section */}
      <div className="py-20" style={{ background: '#FFFFFF' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ 
              color: '#344767',
              letterSpacing: '-0.01em',
              fontWeight: 700
            }}>
              Performance Benchmarks
            </h2>
            <p className="text-xl max-w-3xl mx-auto" style={{ 
              color: '#7b809a', 
              fontWeight: 300,
              lineHeight: '1.625'
            }}>
              Real metrics from NVIDIA H100 GPU testing with Flash Attention 3 optimization
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div style={{
              background: 'linear-gradient(195deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 1))',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              padding: '32px',
              border: 'none'
            }}>
              <h3 className="text-xl font-bold mb-6" style={{ 
                color: '#344767',
                fontWeight: 700
              }}>
                Runtime Performance (H100)
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span style={{ color: '#344767', fontWeight: 500 }}>1 Frame</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full">
                      <div className="h-2 bg-blue-500 rounded-full" style={{ width: '2%' }}></div>
                    </div>
                    <span style={{ color: '#7b809a', fontWeight: 300 }}>0.04s</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span style={{ color: '#344767', fontWeight: 500 }}>10 Frames</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full">
                      <div className="h-2 bg-green-500 rounded-full" style={{ width: '8%' }}></div>
                    </div>
                    <span style={{ color: '#7b809a', fontWeight: 300 }}>0.14s</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span style={{ color: '#344767', fontWeight: 500 }}>50 Frames</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full">
                      <div className="h-2 bg-orange-500 rounded-full" style={{ width: '50%' }}></div>
                    </div>
                    <span style={{ color: '#7b809a', fontWeight: 300 }}>1.04s</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span style={{ color: '#344767', fontWeight: 500 }}>100 Frames</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full">
                      <div className="h-2 bg-red-500 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                    <span style={{ color: '#7b809a', fontWeight: 300 }}>3.12s</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(195deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 1))',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              padding: '32px',
              border: 'none'
            }}>
              <h3 className="text-xl font-bold mb-6" style={{ 
                color: '#344767',
                fontWeight: 700
              }}>
                Memory Usage (H100)
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span style={{ color: '#344767', fontWeight: 500 }}>1 Frame</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full">
                      <div className="h-2 bg-blue-500 rounded-full" style={{ width: '5%' }}></div>
                    </div>
                    <span style={{ color: '#7b809a', fontWeight: 300 }}>1.88 GB</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span style={{ color: '#344767', fontWeight: 500 }}>20 Frames</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full">
                      <div className="h-2 bg-green-500 rounded-full" style={{ width: '15%' }}></div>
                    </div>
                    <span style={{ color: '#7b809a', fontWeight: 300 }}>5.58 GB</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span style={{ color: '#344767', fontWeight: 500 }}>100 Frames</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full">
                      <div className="h-2 bg-orange-500 rounded-full" style={{ width: '55%' }}></div>
                    </div>
                    <span style={{ color: '#7b809a', fontWeight: 300 }}>21.15 GB</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span style={{ color: '#344767', fontWeight: 500 }}>200 Frames</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full">
                      <div className="h-2 bg-red-500 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                    <span style={{ color: '#7b809a', fontWeight: 300 }}>40.63 GB</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 text-center">
            <div style={{
              background: 'linear-gradient(195deg, rgba(0, 102, 255, 0.1), rgba(0, 102, 255, 0.05))',
              borderRadius: '16px',
              padding: '24px',
              border: 'none',
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              <p style={{ 
                color: '#344767', 
                fontWeight: 600,
                marginBottom: '8px'
              }}>
                **Published Results on Multi-View Datasets**
              </p>
              <p style={{ 
                color: '#7b809a', 
                lineHeight: '1.625',
                fontWeight: 300
              }}>
                AUC@30: 90.37 (Production Model) | Research Model: 89.98 | Competitive with state-of-the-art Structure-from-Motion
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-16" style={{
        background: 'linear-gradient(135deg, #0066FF 0%, #FF6B6B 100%)'
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>AI</div>
              <div className="text-blue-100">Powered</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>24/7</div>
              <div className="text-blue-100">Available</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>∞</div>
              <div className="text-blue-100">Scalable</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-white mb-2" style={{ letterSpacing: '-0.02em' }}>✨</div>
              <div className="text-blue-100">Elegant</div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12" style={{ backgroundColor: '#1A1A1A' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p style={{ color: '#718096' }}>
              Built with precision using React, TypeScript, and modern AI technologies
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}