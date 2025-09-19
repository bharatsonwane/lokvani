# TeamOrbit Backend Documentation

Welcome to the comprehensive documentation for the TeamOrbit backend API.

## 🚀 Quick Start

**New to the project?** Start here:

1. [Project Setup](./setup/SETUP.md) - Get the backend running locally
2. [Quick Reference](./QUICK_REFERENCE.md) - Common commands and patterns
3. [Development Guidelines](./development/DEVELOPMENT.md) - Best practices

## 📚 Complete Documentation

### Setup & Configuration

- **[Project Setup](./setup/SETUP.md)** - Complete setup guide from scratch
- **[Development Guidelines](./development/DEVELOPMENT.md)** - Development best practices and patterns

### API & Architecture

- **[API Documentation](./api/API.md)** - Complete API reference and endpoints
- **[Architecture Guide](./architecture/ARCHITECTURE.md)** - System architecture and design patterns
- **[Database Schema](./api/DATABASE.md)** - Database design and relationships

### Deployment & Operations

- **[Deployment Guide](./deployment/DEPLOYMENT.md)** - Production deployment to various platforms

## 🎯 Common Tasks

### For Developers

- **Setting up the backend** → [Setup Guide](./setup/SETUP.md)
- **Understanding the architecture** → [Architecture Guide](./architecture/ARCHITECTURE.md)
- **Working with APIs** → [API Documentation](./api/API.md)
- **Database operations** → [Database Guide](./api/DATABASE.md)

### For DevOps

- **Deploying to production** → [Deployment Guide](./deployment/DEPLOYMENT.md)
- **Environment configuration** → [Setup Guide](./setup/SETUP.md)

### For Contributors

- **Understanding the codebase** → [Development Guide](./development/DEVELOPMENT.md)
- **API patterns** → [API Documentation](./api/API.md)
- **Database schema** → [Database Guide](./api/DATABASE.md)

## 📖 Documentation Structure

```
docs/
├── index.md                    # This file - documentation index
├── QUICK_REFERENCE.md          # Quick commands and common tasks
├── setup/
│   └── SETUP.md                # Complete project setup guide
├── development/
│   └── DEVELOPMENT.md          # Development guidelines and best practices
├── api/
│   ├── API.md                  # API documentation and endpoints
│   └── DATABASE.md             # Database schema and relationships
├── architecture/
│   └── ARCHITECTURE.md         # System architecture and design patterns
└── deployment/
    └── DEPLOYMENT.md           # Production deployment guide
```

## 🔄 Recent Updates

### Backend Architecture Improvements (Latest)

The backend has undergone significant improvements in error handling and middleware architecture:

- **Centralized Error Handling**: Migrated from individual controller error responses to global error middleware using `next(error)`
- **Enhanced Database Middleware**: Improved connection cleanup with comprehensive event listeners
- **Simplified Response Format**: Streamlined API responses with consistent error handling
- **Updated Database Schema**: Table renamed from `user_profile` to `app_user` with lookup table integration
- **Removed Deprecated Middleware**: Eliminated `requestAndResponseHandler.ts` in favor of direct response handling

For detailed information, see:
- [Middleware Architecture Updates](./architecture/MIDDLEWARE.md#recent-updates)
- [API Response Format Changes](./api/API.md#response-format)
- [Database Schema Changes](./api/DATABASE.md#app-user-table)

## 🔄 Keeping Documentation Updated

When making changes to the project, please update the relevant documentation:

- **New API endpoints** → Update API documentation
- **Database changes** → Update database schema docs
- **Architecture changes** → Update architecture guide
- **Configuration changes** → Update setup guide
- **Deployment changes** → Update deployment guide

## 🤝 Contributing to Documentation

1. Use clear, concise language
2. Include code examples where helpful
3. Keep documentation up-to-date with code changes
4. Follow the existing structure and formatting
5. Test all code examples before documenting

---

_This documentation is maintained alongside the codebase. Please keep it updated when making changes to the project._
