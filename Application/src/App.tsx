import { RouterProvider } from '@tanstack/react-router'
import { SupabaseAuthProvider, useSupabaseAuth } from './auth/supabase'
import { router } from './main.tsx'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { CssBaseline, CircularProgress, Box, Typography } from '@mui/material'

function InnerApp() {
  const auth = useSupabaseAuth()

  if (auth.isLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default'
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <Box sx={{ 
            position: 'relative', 
            width: 64, 
            height: 64, 
            mx: 'auto',
            mb: 3,
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
          <CircularProgress size={40} sx={{ mb: 2 }} />
          <Typography variant="body1" color="text.secondary" fontWeight="medium">
            Loading your experience...
          </Typography>
        </Box>
      </Box>
    )
  }

  return <RouterProvider router={router} context={{ auth }} />
}

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0066FF', // hzx.ai blue
      light: '#4D8AFF',
      dark: '#0047B3',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#FF6B6B', // hzx.ai coral/red
      light: '#FF9999',
      dark: '#E55454',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#f0f2f5', // Material Dashboard elegant background
      paper: '#FFFFFF',
    },
    text: {
      primary: '#344767', // Material Dashboard primary text
      secondary: '#7b809a', // Material Dashboard secondary text
    },
    info: {
      main: '#1A73E8',
      light: '#49a3f1',
      dark: '#1662C4',
    },
    success: {
      main: '#4CAF50',
      light: '#66BB6A',
      dark: '#43A047',
    },
    warning: {
      main: '#fb8c00',
      light: '#FFA726',
      dark: '#FB8C00',
    },
    error: {
      main: '#F44335',
      light: '#EF5350',
      dark: '#E53935',
    },
    grey: {
      50: '#f8f9fa',
      100: '#f0f2f5',
      200: '#dee2e6',
      300: '#ced4da',
      400: '#adb5bd',
      500: '#6c757d',
      600: '#495057',
      700: '#343a40',
      800: '#212529',
      900: '#191919',
    },
    divider: '#E2E8F0',
  },
  typography: {
    fontFamily: '"Inter", "Helvetica Neue", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      color: '#1A1A1A',
      letterSpacing: '-0.02em',
    },
    h2: {
      fontWeight: 600,
      color: '#1A1A1A',
      letterSpacing: '-0.01em',
    },
    h3: {
      fontWeight: 600,
      color: '#1A1A1A',
    },
    h6: {
      fontWeight: 600,
      color: '#1A1A1A',
    },
    body1: {
      color: '#4A5568',
      lineHeight: 1.6,
    },
    body2: {
      color: '#718096',
      lineHeight: 1.5,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: '8px',
          fontWeight: 600,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(45, 55, 72, 0.15)',
          },
        },
        contained: {
          background: 'linear-gradient(135deg, #0066FF 0%, #4D8AFF 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #0047B3 0%, #0066FF 100%)',
            transform: 'translateY(-1px)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          borderRadius: '16px',
          border: 'none',
          background: 'linear-gradient(195deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 1))',
          backdropFilter: 'blur(10px)',
        },
        elevation1: {
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        },
        elevation4: {
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        },
        elevation8: {
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            backgroundColor: '#F7FAFC',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#CBD5E0',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#3182CE',
            },
          },
        },
      },
    },
  },
})

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SupabaseAuthProvider>
        <InnerApp />
      </SupabaseAuthProvider>
    </ThemeProvider>
  )
}

export default App