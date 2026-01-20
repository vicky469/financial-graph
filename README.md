# Financial Graph

A knowledge graph application for exploring corporate structures, subsidiaries, and business relationships using SEC filing data.

## 🚀 Quick Start

### Prerequisites

- Node.js 24+ (see `.nvmrc`)
- Bun package manager
- Google Cloud Platform account (for authentication)

### 1. Clone and Install

```bash
git clone <repository-url>
cd financial-graph
bun install
```

### 2. Set up Google OAuth Authentication

The application uses Google OAuth for secure authentication with 8-hour session management.

1. **Follow the detailed setup guide**: [GOOGLE-OAUTH-SETUP.md](./GOOGLE-OAUTH-SETUP.md)

2. **Quick setup summary**:
   - Create a Google Cloud Project
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Configure authorized origins and redirect URIs
   - Update environment variables

3. **Configure environment variables**:
   ```bash
   # Frontend
   cd frontend
   cp .env.example .env
   # Edit .env and add your Google Client ID
   ```

### 3. Start Development

```bash
# Start frontend
cd frontend
bun run dev

# Start backend (in another terminal)
cd backend
bun run dev
```

Visit `http://localhost:5173` and sign in with Google.

## 🔐 Authentication

### Features

- **Google OAuth Integration**: Secure authentication using Google accounts
- **8-Hour Sessions**: Automatic logout after 8 hours for security
- **Session Management**: Persistent sessions with automatic validation
- **User Profile**: Display user information and profile picture

### Session Behavior

- Sessions are valid for 8 hours from login
- The app checks session validity every minute
- Users are automatically logged out when sessions expire
- Session data is stored securely in localStorage

### Testing Authentication

Open browser console and use the testing utilities:

```javascript
// Test session management
window.authTest.testSessionManagement();

// Check current auth state
window.authTest.checkAuthState();

// Test logout
window.authTest.testLogout();
```

## 🏗️ Architecture

### Frontend (`/frontend`)

- **React 19** with TypeScript
- **Vite** for development and building
- **InstantDB** for real-time data and authentication
- **Tailwind CSS** for styling
- **React Flow** for graph visualization

### Backend (`/backend`)

- **Node.js** with TypeScript
- **SEC filing parsers** for extracting corporate data
- **InstantDB** for data storage
- **LLM integration** for data enrichment

### Shared (`/shared`)

- **Common types** and utilities
- **InstantDB schema** definitions
- **Validation logic**

## 📊 Features

### Corporate Structure Visualization

- **Interactive graphs** showing parent-subsidiary relationships
- **Jurisdiction mapping** with geographic visualization
- **Treemap views** for hierarchical data exploration
- **Search functionality** for finding specific companies

### Data Sources

- **SEC Exhibit 21** filings (subsidiary lists)
- **SEC company metadata** (CIK, tickers, names)
- **S&P 500** company classifications
- **Jurisdiction normalization** (ISO country codes)

### Advanced Features

- **Real-time collaboration** via InstantDB
- **Mobile-responsive** design
- **Keyboard shortcuts** for power users
- **Export capabilities** (CSV, Excel)

## 🛠️ Development

### Project Structure

```
financial-graph/
├── frontend/          # React application
├── backend/           # Node.js API and parsers
├── shared/            # Common code and types
├── docs/              # Documentation
└── tools/             # Development utilities
```

### Key Commands

```bash
# Install dependencies
bun install

# Development
bun run dev          # Start frontend
cd backend && bun run dev  # Start backend

# Building
bun run build        # Build frontend
cd backend && bun run build  # Build backend

# Testing
bun run test         # Run tests
```

### Environment Variables

#### Frontend (`.env`)
```bash
VITE_INSTANTDB_APP_ID=your-instantdb-app-id
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

#### Backend (`.env`)
```bash
INSTANTDB_ADMIN_TOKEN=your-instantdb-admin-token
# Additional backend configuration...
```

## 📚 Documentation

- **[Google OAuth Setup](./GOOGLE-OAUTH-SETUP.md)** - Complete authentication setup guide
- **[Project Documentation](./docs/README.md)** - Technical documentation and architecture
- **[API Documentation](./backend/docs/)** - Backend API reference
- **[Data Sources](./docs/data-sources/)** - Information about SEC filing formats

## 🔧 Troubleshooting

### Authentication Issues

1. **"redirect_uri_mismatch"**: Check Google Cloud Console redirect URIs
2. **"invalid_client"**: Verify Google Client ID in environment variables
3. **Session not persisting**: Check browser localStorage and console errors

### Development Issues

1. **Port conflicts**: Frontend runs on 5173, backend on 3000
2. **CORS errors**: Ensure backend is running and accessible
3. **Build failures**: Check Node.js version (requires 24+)

### Getting Help

1. Check browser console for error messages
2. Review the setup guides in `/docs`
3. Test authentication with `window.authTest` utilities
4. Check InstantDB dashboard for data and auth logs

## 🚀 Deployment

### Production Setup

1. **Configure production OAuth credentials**
2. **Set production environment variables**
3. **Build and deploy frontend**
4. **Deploy backend services**
5. **Configure InstantDB for production**

See deployment guides in `/docs` for detailed instructions.

## 📄 License

[License information]

## 🤝 Contributing

[Contributing guidelines]

---

**Last Updated**: January 2026
**Authentication**: Google OAuth with 8-hour sessions
**Status**: Active development