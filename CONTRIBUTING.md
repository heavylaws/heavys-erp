# Contributing to Highway Cafe POS System

Thank you for your interest in contributing to the Highway Cafe POS System! This document provides guidelines for contributing to this project.

## Code of Conduct

By participating in this project, you agree to abide by our code of conduct:
- Be respectful and inclusive
- Focus on constructive feedback
- Help create a welcoming environment for all contributors

## Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/highway-cafe-pos.git
   cd highway-cafe-pos
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your local database configuration
   ```

4. **Database Setup**
   ```bash
   npm run db:push
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## Project Structure

```
highway-cafe-pos/
├── client/src/           # React frontend
│   ├── components/       # Reusable UI components
│   ├── pages/           # Page components
│   └── hooks/           # Custom React hooks
├── server/              # Express backend
│   ├── routes.ts        # API routes
│   ├── storage.ts       # Database operations
│   └── index.ts         # Server entry point
├── shared/schema.ts     # Database schemas
└── docs/               # Documentation
```

## Contributing Guidelines

### Pull Request Process

1. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Follow the existing code style
   - Add tests for new features
   - Update documentation as needed

3. **Test Your Changes**
   ```bash
   npm run check  # TypeScript checking
   npm run build  # Production build test
   ```

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Submit Pull Request**
   - Provide a clear description of changes
   - Reference any related issues
   - Include screenshots for UI changes

### Commit Message Format

Follow conventional commits format:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### Code Style

- **TypeScript**: Use strict mode and proper typing
- **Components**: Follow React hooks patterns
- **Styling**: Use Tailwind CSS classes
- **Formatting**: Code will be automatically formatted

### Testing

- Write tests for new features
- Ensure existing tests pass
- Follow the testing patterns in `TESTING-GUIDE.md`

## Areas for Contribution

### High Priority
- **Bug Fixes**: Check GitHub issues for bug reports
- **Performance**: Optimize database queries and rendering
- **Accessibility**: Improve WCAG compliance
- **Mobile**: Enhance tablet/mobile experience

### Feature Requests
- **Integrations**: Payment processing, accounting software
- **Reporting**: Advanced analytics and reports
- **Localization**: Multi-language support
- **API**: REST API documentation and improvements

### Documentation
- **User Guides**: Role-specific operation manuals
- **API Documentation**: Endpoint specifications
- **Deployment**: Additional platform support
- **Tutorials**: Video guides and walkthroughs

## Issue Reporting

### Bug Reports
Include:
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, browser, Node version)
- Screenshots if applicable

### Feature Requests
Include:
- Clear description of the feature
- Use cases and benefits
- Potential implementation approach
- Mockups or examples if available

## Security Issues

For security vulnerabilities:
- **Do not** open public issues
- Email security concerns privately
- Provide detailed reproduction steps
- Allow time for patching before disclosure

## Development Tips

### Database Changes
```bash
# After modifying schema.ts
npm run db:push
```

### Frontend Development
```bash
# Components use Shadcn/ui patterns
# State management via TanStack Query
# Routing with Wouter
```

### Backend Development
```bash
# API routes in server/routes.ts
# Database operations in server/storage.ts
# Real-time features use WebSocket
```

## Getting Help

- **Documentation**: Check existing docs first
- **GitHub Discussions**: For questions and ideas
- **Issues**: For bugs and feature requests
- **Code Review**: Maintainers will provide feedback

## Recognition

Contributors will be:
- Listed in project documentation
- Credited in release notes
- Invited to maintainer discussions for significant contributions

Thank you for contributing to the Highway Cafe POS System!