#!/usr/bin/env python3
"""
VGGT Server Proxy - Interfaces between the web app and VGGT model
Provides REST API endpoints for real-time 3D reconstruction
"""

import os
import io
import json
import time
import asyncio
import requests
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import torch
from PIL import Image
from flask import Flask, request, jsonify, Response
from flask_cors import CORS

# Import your VGGT model (adjust path as needed)
import sys
vggt_path = '/Users/siddhantsingh/Documents/GitHub/txmomentum-hackathon-2025/vggt'
sys.path.insert(0, vggt_path)

# Try different import approaches for VGGT
VGGT_AVAILABLE = False
VGGT_MODEL = None

try:
    # First try importing from vggt directory
    import demo_viser
    from demo_viser import VGGT, preprocess_images
    print("✅ VGGT model imported from demo_viser successfully")
    VGGT_AVAILABLE = True
    VGGT_MODEL = VGGT
except ImportError:
    try:
        # Alternative: try importing from other potential locations
        from model import VGGT
        from utils.preprocessing import preprocess_images
        print("✅ VGGT model imported from model module successfully")
        VGGT_AVAILABLE = True
        VGGT_MODEL = VGGT
    except ImportError as e:
        print(f"⚠️  VGGT model not available: {e}")
        print("Running in demo mode - will return mock data")
        VGGT_AVAILABLE = False

app = Flask(__name__)
CORS(app, origins=['http://localhost:3000', 'http://localhost:5173'])

@dataclass
class VGGTSession:
    session_id: str
    model: Optional[VGGT]
    frames: List[np.ndarray]
    frame_numbers: List[int] 
    last_update: float
    reconstruction_data: Optional[Dict[str, Any]] = None

class VGGTServerProxy:
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model: Optional[VGGT] = None
        self.sessions: Dict[str, VGGTSession] = {}
        self.executor = ThreadPoolExecutor(max_workers=2)
        
        print(f"🔬 VGGT Server Proxy initialized on device: {self.device}")
        
    def load_model(self):
        """Load VGGT model once"""
        if not VGGT_AVAILABLE:
            print("⚠️  VGGT model not available, using mock mode")
            return
            
        if self.model is None:
            try:
                print("🔄 Loading VGGT model...")
                self.model = VGGT_MODEL().to(self.device)
                self.model.eval()
                print("✅ VGGT model loaded successfully")
            except Exception as e:
                print(f"❌ Failed to load VGGT model: {e}")
                raise

    async def download_image(self, url: str) -> Optional[np.ndarray]:
        """Download image from URL"""
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            image = Image.open(io.BytesIO(response.content))
            if image.mode != 'RGB':
                image = image.convert('RGB')
                
            return np.array(image)
        except Exception as e:
            print(f"❌ Failed to download image {url}: {e}")
            return None

    async def process_reconstruction(self, session_id: str, image_urls: List[str], frame_numbers: List[int]) -> Dict[str, Any]:
        """Process images with VGGT model"""
        try:
            self.load_model()
            
            # If VGGT is not available, return mock data
            if not VGGT_AVAILABLE:
                print(f"🎭 Generating mock reconstruction data for {len(image_urls)} images")
                return self._generate_mock_reconstruction(session_id, image_urls, frame_numbers)
            
            # Download all images
            print(f"📥 Downloading {len(image_urls)} images for session {session_id}")
            download_tasks = [self.download_image(url) for url in image_urls]
            images = await asyncio.gather(*download_tasks)
            
            # Filter out failed downloads
            valid_images = []
            valid_frame_numbers = []
            for img, frame_num in zip(images, frame_numbers):
                if img is not None:
                    valid_images.append(img)
                    valid_frame_numbers.append(frame_num)
            
            if len(valid_images) == 0:
                raise ValueError("No valid images downloaded")
            
            print(f"✅ Downloaded {len(valid_images)} valid images")
            
            # Get or create session
            if session_id not in self.sessions:
                self.sessions[session_id] = VGGTSession(
                    session_id=session_id,
                    model=self.model,
                    frames=[],
                    frame_numbers=[],
                    last_update=time.time()
                )
            
            session = self.sessions[session_id]
            
            # Add new frames to session
            session.frames.extend(valid_images)
            session.frame_numbers.extend(valid_frame_numbers)
            session.last_update = time.time()
            
            # Keep only recent frames (last 25 frames max for performance)
            if len(session.frames) > 25:
                session.frames = session.frames[-25:]
                session.frame_numbers = session.frame_numbers[-25:]
            
            print(f"🔬 Processing {len(session.frames)} total frames for session {session_id}")
            
            # Preprocess images for VGGT
            images_tensor = preprocess_images(session.frames).to(self.device)
            print(f"📊 Preprocessed images shape: {images_tensor.shape}")
            
            # Run VGGT inference
            with torch.no_grad():
                print("🧠 Running VGGT inference...")
                start_time = time.time()
                
                outputs = self.model(images_tensor)
                
                inference_time = time.time() - start_time
                print(f"⚡ VGGT inference completed in {inference_time:.2f}s")
                
                # Extract outputs
                pose_encoding = outputs['poses']  # [N, pose_dim]
                depth_maps = outputs['depths']    # [N, H, W]
                point_clouds = outputs['points']  # [N, num_points, 3]
                
                # Convert poses to camera matrices
                extrinsic_matrices, intrinsic_matrices = convert_poses_to_cameras(pose_encoding)
                
                # Convert to numpy and flatten for JSON serialization
                result = {
                    'session_id': session_id,
                    'frame_count': len(session.frames),
                    'frame_numbers': session.frame_numbers,
                    'poses': pose_encoding.cpu().numpy().flatten().tolist(),
                    'depths': depth_maps.cpu().numpy().flatten().tolist(),
                    'points_3d': point_clouds.cpu().numpy().flatten().tolist(),
                    'cameras': [
                        {
                            'extrinsic': ext.flatten().tolist(),
                            'intrinsic': intr.flatten().tolist()
                        }
                        for ext, intr in zip(extrinsic_matrices, intrinsic_matrices)
                    ],
                    'inference_time': inference_time,
                    'timestamp': time.time(),
                    'image_shape': images_tensor.shape[2:],  # [H, W]
                    'device': str(self.device)
                }
                
                # Cache result in session
                session.reconstruction_data = result
                
                print(f"✅ VGGT reconstruction completed: {len(session.frames)} frames, {inference_time:.2f}s")
                return result
                
        except Exception as e:
            print(f"❌ VGGT reconstruction failed: {e}")
            raise

    def _generate_mock_reconstruction(self, session_id: str, image_urls: List[str], frame_numbers: List[int]) -> Dict[str, Any]:
        """Generate mock reconstruction data for testing"""
        import time
        time.sleep(0.5)  # Simulate processing time
        
        num_frames = len(image_urls)
        
        # Generate mock data with realistic dimensions
        mock_poses = np.random.randn(num_frames, 12).flatten()  # 12D pose encoding
        mock_depths = np.random.rand(num_frames, 224, 224).flatten()  # Mock depth maps
        mock_points = np.random.randn(num_frames, 1000, 3).flatten()  # Mock 3D points
        
        # Mock camera matrices
        mock_cameras = []
        for i in range(num_frames):
            extrinsic = np.eye(4).flatten()  # Identity matrix as mock extrinsic
            intrinsic = np.array([[520, 0, 320], [0, 520, 240], [0, 0, 1]]).flatten()  # Mock intrinsic
            mock_cameras.append({
                'extrinsic': extrinsic.tolist(),
                'intrinsic': intrinsic.tolist()
            })
        
        result = {
            'session_id': session_id,
            'frame_count': num_frames,
            'frame_numbers': frame_numbers,
            'poses': mock_poses.tolist(),
            'depths': mock_depths.tolist(),
            'points_3d': mock_points.tolist(),
            'cameras': mock_cameras,
            'inference_time': 0.5,
            'timestamp': time.time(),
            'image_shape': [224, 224],
            'device': 'mock',
            'mock_data': True
        }
        
        return result

# Global instance
proxy = VGGTServerProxy()

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'device': str(proxy.device),
        'vggt_available': VGGT_AVAILABLE,
        'model_loaded': proxy.model is not None,
        'active_sessions': len(proxy.sessions),
        'mode': 'production' if VGGT_AVAILABLE else 'mock',
        'timestamp': time.time()
    })

@app.route('/api/reconstruct', methods=['POST'])
def reconstruct():
    """Main reconstruction endpoint"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
            
        image_urls = data.get('images', [])
        session_id = data.get('session_id', f'session_{int(time.time())}')
        frame_numbers = data.get('frame_numbers', list(range(len(image_urls))))
        
        if not image_urls:
            return jsonify({'error': 'No images provided'}), 400
            
        print(f"🔬 Reconstruction request: {len(image_urls)} images for session {session_id}")
        
        # Run reconstruction in thread pool to avoid blocking
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                proxy.process_reconstruction(session_id, image_urls, frame_numbers)
            )
            return jsonify(result)
        finally:
            loop.close()
            
    except Exception as e:
        print(f"❌ Reconstruction error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/sessions/<session_id>', methods=['GET'])
def get_session_data(session_id):
    """Get cached reconstruction data for a session"""
    try:
        if session_id not in proxy.sessions:
            return jsonify({'error': 'Session not found'}), 404
            
        session = proxy.sessions[session_id]
        
        if session.reconstruction_data is None:
            return jsonify({'error': 'No reconstruction data available'}), 404
            
        return jsonify(session.reconstruction_data)
        
    except Exception as e:
        print(f"❌ Session data error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/sessions', methods=['GET'])
def list_sessions():
    """List all active sessions"""
    try:
        session_info = {}
        current_time = time.time()
        
        for session_id, session in proxy.sessions.items():
            session_info[session_id] = {
                'frame_count': len(session.frames),
                'last_update': session.last_update,
                'age_seconds': current_time - session.last_update,
                'has_reconstruction': session.reconstruction_data is not None
            }
            
        return jsonify({
            'active_sessions': len(proxy.sessions),
            'sessions': session_info
        })
        
    except Exception as e:
        print(f"❌ List sessions error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/sessions/<session_id>', methods=['DELETE'])
def clear_session(session_id):
    """Clear a session"""
    try:
        if session_id in proxy.sessions:
            del proxy.sessions[session_id]
            print(f"🗑️ Cleared session: {session_id}")
            return jsonify({'message': f'Session {session_id} cleared'})
        else:
            return jsonify({'error': 'Session not found'}), 404
            
    except Exception as e:
        print(f"❌ Clear session error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("🚀 Starting VGGT Server Proxy...")
    print("🔗 VGGT model server running on http://localhost:8081")
    print("🔗 Viser visualization available on http://localhost:8080")
    print("📡 API endpoints:")
    print("  - GET  /api/health")
    print("  - POST /api/reconstruct")
    print("  - GET  /api/sessions")
    print("  - GET  /api/sessions/<session_id>")
    print("  - DELETE /api/sessions/<session_id>")
    
    app.run(host='0.0.0.0', port=8081, debug=False, threaded=True)