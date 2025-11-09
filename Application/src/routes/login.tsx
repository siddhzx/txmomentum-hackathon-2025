import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useSupabaseAuth } from '../auth/supabase'
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  Container
} from '@mui/material'
import { Google as GoogleIcon } from '@mui/icons-material'

export const Route = createFileRoute('/login')({
  validateSearch: (search) => ({
    redirect: (search.redirect as string) || '/dashboard',
  }),
  component: LoginComponent,
})

function LoginComponent() {
  const auth = useSupabaseAuth()
  const { redirect } = Route.useSearch()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      await auth.login(email, password)
      window.location.href = redirect
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    setError('')

    try {
      await auth.loginWithGoogle()
    } catch (err: any) {
      setError(err.message || 'Google login failed')
    } finally {
      setIsGoogleLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        py: 4,
        background: '#f0f2f5',
      }}
    >
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ 
            position: 'relative', 
            width: 64, 
            height: 64, 
            mx: 'auto',
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Box sx={{ 
              width: 24, 
              height: 24, 
              bgcolor: 'primary.main', 
              borderRadius: '50%',
              position: 'absolute',
              left: 8
            }} />
            <Box sx={{ 
              width: 40, 
              height: 8, 
              bgcolor: 'secondary.main',
              borderRadius: 4,
              transform: 'rotate(45deg)',
              position: 'absolute'
            }} />
          </Box>
          <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
            Welcome Back
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Sign in to continue to Ontology
          </Typography>
        </Box>

        <Paper
          elevation={8}
          sx={{
            p: 4,
            borderRadius: 3,
          }}
        >
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Button
            fullWidth
            variant="outlined"
            size="large"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading}
            startIcon={isGoogleLoading ? <CircularProgress size={20} /> : <GoogleIcon />}
            sx={{
              mb: 3,
              py: 1.5,
              borderColor: 'grey.300',
              color: 'text.primary',
              bgcolor: 'white',
              borderWidth: '1px',
              fontWeight: 600,
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'grey.50',
                boxShadow: '0 4px 12px rgba(45, 55, 72, 0.15)',
              },
            }}
          >
            {isGoogleLoading ? 'Signing in...' : 'Continue with Google'}
          </Button>

          <Divider sx={{ mb: 3 }}>or</Divider>

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
              autoFocus
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              sx={{ mb: 3 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isLoading}
              sx={{
                py: 1.5,
                mb: 2,
                fontWeight: 'bold',
              }}
            >
              {isLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Signing in...
                </Box>
              ) : (
                'Sign In'
              )}
            </Button>
          </Box>

          <Typography variant="body2" align="center" color="text.secondary">
            Don't have an account?{' '}
            <Button variant="text" size="small" sx={{ textTransform: 'none' }}>
              Sign up
            </Button>
          </Typography>
        </Paper>

        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Button
            variant="text"
            onClick={() => window.history.back()}
            sx={{ textTransform: 'none', color: 'text.secondary' }}
          >
            ← Back to home
          </Button>
        </Box>
      </Container>
    </Box>
  )
}