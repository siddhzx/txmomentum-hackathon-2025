import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Bell, Home, LogOut, Menu, Settings, User, X } from 'lucide-react'
import { useSupabaseAuth } from '../auth/supabase'
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Avatar,
  Badge,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const auth = useSupabaseAuth()

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'saturate(200%) blur(30px)',
          borderBottom: 'none',
          boxShadow: '0 0 1px 1px rgba(255, 255, 255, 0.9) inset, 0 20px 27px 0px rgba(0, 0, 0, 0.05)',
          color: 'text.primary',
          borderRadius: 0,
        }}
      >
        <Toolbar sx={{ maxWidth: '1200px', width: '100%', mx: 'auto', px: { xs: 2, sm: 3 } }}>
          {/* Mobile Menu Button */}
          <IconButton
            edge="start"
            onClick={() => setIsOpen(true)}
            sx={{ mr: 2, display: { lg: 'none' }, color: 'text.primary' }}
          >
            <Menu />
          </IconButton>

          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: { xs: 1, lg: 0 } }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              <Box sx={{ 
                position: 'relative', 
                width: 32, 
                height: 32, 
                mr: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Box sx={{ 
                  width: 12, 
                  height: 12, 
                  bgcolor: 'primary.main', 
                  borderRadius: '50%',
                  position: 'absolute',
                  left: 0
                }} />
                <Box sx={{ 
                  width: 20, 
                  height: 4, 
                  bgcolor: 'secondary.main',
                  borderRadius: 2,
                  transform: 'rotate(45deg)',
                  position: 'absolute'
                }} />
              </Box>
              <Typography
                variant="h6"
                component="h1"
                sx={{
                  fontWeight: 700,
                  color: 'text.primary',
                  display: { xs: 'none', sm: 'block' },
                  fontSize: '1.1rem',
                  letterSpacing: '-0.01em'
                }}
              >
                Ontology
              </Typography>
            </Link>
          </Box>

          {/* Desktop Navigation */}
          <Box sx={{ flexGrow: 1, display: { xs: 'none', lg: 'flex' }, justifyContent: 'center' }}>
            <Button
              component={Link}
              to="/"
              sx={{
                mx: 1,
                color: 'text.primary',
                fontWeight: 500,
                '&:hover': {
                  bgcolor: 'grey.50',
                },
              }}
            >
              Home
            </Button>
            <Button
              component={Link}
              to="/login"
              sx={{
                mx: 1,
                color: 'text.primary',
                fontWeight: 500,
                '&:hover': {
                  bgcolor: 'grey.50',
                },
              }}
            >
              Login
            </Button>
          </Box>

          {/* Right side */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {auth.isAuthenticated ? (
              <>
                <IconButton sx={{ color: 'text.primary' }}>
                  <Badge badgeContent={2} color="error">
                    <Bell size={20} />
                  </Badge>
                </IconButton>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mx: 1 }}>
                  <Avatar
                    sx={{
                      width: 32,
                      height: 32,
                      bgcolor: 'primary.main',
                      fontSize: '0.875rem',
                    }}
                  >
                    <User size={16} />
                  </Avatar>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      color: 'text.primary',
                      display: { xs: 'none', sm: 'block' },
                    }}
                  >
                    {auth.user?.email?.split('@')[0]}
                  </Typography>
                </Box>

                <IconButton
                  onClick={() => auth.logout()}
                  sx={{
                    color: 'error.main',
                    '&:hover': {
                      bgcolor: 'error.light',
                      color: 'error.dark',
                    },
                  }}
                >
                  <LogOut size={20} />
                </IconButton>
              </>
            ) : (
              <Button
                component={Link}
                to="/login"
                variant="contained"
                sx={{
                  fontWeight: 600,
                  px: 3,
                  background: 'linear-gradient(135deg, #2D3748 0%, #4A5568 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #1A202C 0%, #2D3748 100%)',
                  },
                }}
              >
                Sign In
              </Button>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="left"
        open={isOpen}
        onClose={() => setIsOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: 280,
            bgcolor: 'background.paper',
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid', borderBottomColor: 'grey.200' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ 
                position: 'relative', 
                width: 32, 
                height: 32, 
                mr: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Box sx={{ 
                  width: 12, 
                  height: 12, 
                  bgcolor: 'primary.main', 
                  borderRadius: '50%',
                  position: 'absolute',
                  left: 0
                }} />
                <Box sx={{ 
                  width: 20, 
                  height: 4, 
                  bgcolor: 'secondary.main',
                  borderRadius: 2,
                  transform: 'rotate(45deg)',
                  position: 'absolute'
                }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', letterSpacing: '-0.01em' }}>
                Ontology
              </Typography>
            </Box>
            <IconButton onClick={() => setIsOpen(false)} size="small">
              <X size={20} />
            </IconButton>
          </Box>
        </Box>

        <List sx={{ flexGrow: 1 }}>
          <ListItem disablePadding>
            <ListItemButton
              component={Link}
              to="/"
              onClick={() => setIsOpen(false)}
              sx={{
                '&:hover': {
                  bgcolor: 'grey.50',
                },
              }}
            >
              <ListItemIcon>
                <Home size={20} />
              </ListItemIcon>
              <ListItemText primary="Home" />
            </ListItemButton>
          </ListItem>
          
          <ListItem disablePadding>
            <ListItemButton
              component={Link}
              to="/login"
              onClick={() => setIsOpen(false)}
              sx={{
                '&:hover': {
                  bgcolor: 'grey.50',
                },
              }}
            >
              <ListItemIcon>
                <User size={20} />
              </ListItemIcon>
              <ListItemText primary="Login" />
            </ListItemButton>
          </ListItem>

          {auth.isAuthenticated && (
            <>
              <Divider sx={{ my: 1 }} />
              <ListItem disablePadding>
                <ListItemButton
                  sx={{
                    '&:hover': {
                      bgcolor: 'grey.50',
                    },
                  }}
                >
                  <ListItemIcon>
                    <Settings size={20} />
                  </ListItemIcon>
                  <ListItemText primary="Settings" />
                </ListItemButton>
              </ListItem>
              
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    auth.logout()
                    setIsOpen(false)
                  }}
                  sx={{
                    '&:hover': {
                      bgcolor: 'error.light',
                    },
                    color: 'error.main',
                  }}
                >
                  <ListItemIcon sx={{ color: 'error.main' }}>
                    <LogOut size={20} />
                  </ListItemIcon>
                  <ListItemText primary="Sign Out" />
                </ListItemButton>
              </ListItem>
            </>
          )}
        </List>

        {auth.isAuthenticated && (
          <Box sx={{ p: 2, borderTop: '1px solid', borderTopColor: 'grey.200', bgcolor: 'grey.50' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: 'primary.main',
                }}
              >
                <User size={20} />
              </Avatar>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }} noWrap>
                  {auth.user?.email}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Signed in
                </Typography>
              </Box>
            </Box>
          </Box>
        )}
      </Drawer>
    </>
  )
}
