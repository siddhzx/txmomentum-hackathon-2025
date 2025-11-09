import { supabase } from '../utils/supabase'

interface OntologyFrame {
  frameId: string
  timestamp: number
  imageUrl: string
  sessionId: string
  frameNumber: number
}

interface OntologyReconstructionResult {
  poses: Float32Array
  depths: Float32Array
  points3D: Float32Array
  cameras: {
    extrinsic: Float32Array
    intrinsic: Float32Array
  }[]
  timestamp: number
  frameCount: number
}

interface OntologyConfig {
  serverUrl: string
  batchSize: number
  processingInterval: number
  maxFramesBuffer: number
}

export class OntologyService {
  private config: OntologyConfig
  private frameBuffer: OntologyFrame[] = []
  private processingQueue: OntologyFrame[] = []
  private isProcessing = false
  private reconstructionCallback?: (result: OntologyReconstructionResult) => void
  private sessionId: string = ''

  constructor(config: Partial<OntologyConfig> = {}) {
    this.config = {
      serverUrl: 'http://localhost:8081',
      batchSize: 5,
      processingInterval: 2000, // Process every 2 seconds
      maxFramesBuffer: 50,
      ...config
    }
  }

  /**
   * Initialize Ontology service with session ID
   */
  public initialize(sessionId: string) {
    this.sessionId = sessionId
    console.log('🔬 Ontology Service initialized for session:', sessionId)
  }

  /**
   * Set callback for reconstruction results
   */
  public onReconstruction(callback: (result: OntologyReconstructionResult) => void) {
    this.reconstructionCallback = callback
  }

  /**
   * Add a new frame for processing
   */
  public async addFrame(sessionId: string, frameNumber: number, filePath: string) {
    if (!this.sessionId || this.sessionId !== sessionId) {
      console.log('📸 Session mismatch, reinitializing Ontology service')
      this.initialize(sessionId)
    }

    // Download frame from Supabase
    const imageUrl = await this.downloadFrameFromSupabase(filePath)
    if (!imageUrl) {
      console.error('❌ Failed to download frame:', filePath)
      return
    }

    const frame: OntologyFrame = {
      frameId: `${sessionId}_${frameNumber}`,
      timestamp: Date.now(),
      imageUrl,
      sessionId,
      frameNumber
    }

    this.frameBuffer.push(frame)
    console.log('📸 Added frame to Ontology buffer:', frame.frameId, 'Buffer size:', this.frameBuffer.length)

    // Limit buffer size
    if (this.frameBuffer.length > this.config.maxFramesBuffer) {
      this.frameBuffer.shift()
    }

    // Try to process if we have enough frames
    this.tryProcessFrames()
  }

  /**
   * Download frame blob from Supabase storage
   */
  private async downloadFrameFromSupabase(filePath: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from('media-captures')
        .createSignedUrl(filePath, 300) // 5 minute expiry

      if (error) {
        console.error('❌ Supabase download error:', error)
        return null
      }

      return data.signedUrl
    } catch (error) {
      console.error('❌ Frame download error:', error)
      return null
    }
  }

  /**
   * Try to process frames if we have enough
   */
  private async tryProcessFrames() {
    if (this.isProcessing || this.frameBuffer.length < this.config.batchSize) {
      return
    }

    this.isProcessing = true
    
    // Take batch of frames
    const framesToProcess = this.frameBuffer.splice(0, this.config.batchSize)
    this.processingQueue.push(...framesToProcess)

    console.log('🔬 Processing batch of', framesToProcess.length, 'frames')
    
    try {
      const result = await this.processFramesWithOntology(framesToProcess)
      if (result && this.reconstructionCallback) {
        this.reconstructionCallback(result)
      }
    } catch (error) {
      console.error('❌ Ontology processing error:', error)
    } finally {
      this.isProcessing = false
      
      // Process remaining frames if any
      setTimeout(() => this.tryProcessFrames(), this.config.processingInterval)
    }
  }

  /**
   * Process frames with Ontology model
   */
  private async processFramesWithOntology(frames: OntologyFrame[]): Promise<OntologyReconstructionResult | null> {
    try {
      const frameUrls = frames.map(f => f.imageUrl)
      
      console.log('🔬 Sending to Ontology server:', frameUrls.length, 'images')

      // Send frames to Ontology server
      const response = await fetch(`${this.config.serverUrl}/api/reconstruct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          images: frameUrls,
          session_id: this.sessionId,
          frame_numbers: frames.map(f => f.frameNumber),
          timestamp: Date.now()
        })
      })

      if (!response.ok) {
        throw new Error(`Ontology server error: ${response.status}`)
      }

      const data = await response.json()
      console.log('✅ Ontology reconstruction completed:', data.frame_count, 'frames processed')

      return {
        poses: new Float32Array(data.poses),
        depths: new Float32Array(data.depths),
        points3D: new Float32Array(data.points_3d),
        cameras: data.cameras.map((cam: any) => ({
          extrinsic: new Float32Array(cam.extrinsic),
          intrinsic: new Float32Array(cam.intrinsic)
        })),
        timestamp: data.timestamp,
        frameCount: data.frame_count
      }
    } catch (error) {
      console.error('❌ Ontology processing failed:', error)
      return null
    }
  }

  /**
   * Get current processing status
   */
  public getStatus() {
    return {
      bufferSize: this.frameBuffer.length,
      queueSize: this.processingQueue.length,
      isProcessing: this.isProcessing,
      sessionId: this.sessionId
    }
  }

  /**
   * Clear all buffers and reset
   */
  public reset() {
    this.frameBuffer = []
    this.processingQueue = []
    this.isProcessing = false
    this.sessionId = ''
    console.log('🔄 Ontology Service reset')
  }

  /**
   * Force process all buffered frames
   */
  public async forceProcess() {
    if (this.frameBuffer.length === 0) {
      console.log('📭 No frames to process')
      return
    }

    console.log('⚡ Force processing', this.frameBuffer.length, 'frames')
    
    while (this.frameBuffer.length > 0) {
      const batch = this.frameBuffer.splice(0, this.config.batchSize)
      try {
        const result = await this.processFramesWithOntology(batch)
        if (result && this.reconstructionCallback) {
          this.reconstructionCallback(result)
        }
      } catch (error) {
        console.error('❌ Force process error:', error)
      }
    }
  }
}

// Export singleton instance
export const ontologyService = new OntologyService()