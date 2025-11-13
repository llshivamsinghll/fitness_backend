# Fitness App Backend - Production Ready

## Production Features

### Security
- [x] CORS Protection: Configured with allowed origins
- [x] Rate Limiting: Prevents abuse and DDoS attacks
- [x] Security Headers: XSS, clickjacking, and MIME-type sniffing protection
- [x] JWT Authentication: Secure token-based auth with expiration
- [x] Password Hashing: Bcrypt with salt rounds
- [x] Input Validation: Email, password, and data validation
- [x] Error Handling: Global error handler with proper logging

### Performance
- [x] Request Logging: Comprehensive logging for debugging
- [x] Graceful Shutdown: Proper cleanup on server termination
- [x] Database Optimization: Efficient Prisma queries
- [x] Response Compression: Optimized payload sizes

### Monitoring
- [x] Health Check Endpoint: /api/health
- [x] Error Logging: Console-based (ready for external services)
- [x] Request Tracking: Timestamps and origin tracking

## Prerequisites

- Node.js 18+ or higher
- PostgreSQL database (Neon, Supabase, or any Postgres provider)
- Cloudinary account (for image uploads)
- Groq API key (for AI features)

## Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Update the following variables in `.env`:

   ```env
   # Generate a secure JWT secret:
   # node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   JWT_SECRET=your-generated-secret-key
   
   # Your production frontend URL
   FRONTEND_URL=https://your-frontend.vercel.app
   
   # Database connection string
   DATABASE_URL=your-database-url
   
   # Cloudinary credentials
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   
   # Groq API key
   GROQ_API_KEY=your-groq-key
   ```

## Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run build

# Run database migrations
npx prisma migrate deploy
```

## Deployment

### Render.com

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure build settings:
   - Build Command: `npm install && npx prisma generate && npx prisma migrate deploy`
   - Start Command: `npm start`
4. Add environment variables from your `.env` file
5. Deploy

### Railway.app

1. Create a new project on Railway
2. Connect your GitHub repository
3. Add a PostgreSQL database (automatic DATABASE_URL)
4. Add environment variables
5. Deploy

### Vercel

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```
2. Deploy:
   ```bash
   vercel
   ```
3. Add environment variables in Vercel dashboard
4. Redeploy for changes to take effect

## Security Checklist

Before deploying to production, ensure:

- [ ] JWT_SECRET is strong and unique (64+ characters)
- [ ] NODE_ENV is set to 'production'
- [ ] DATABASE_URL uses SSL (sslmode=require)
- [ ] FRONTEND_URL is set to your actual frontend domain
- [ ] All API keys are kept secret and not committed to Git
- [ ] CORS origins are properly configured
- [ ] Rate limiting is enabled
- [ ] Error messages don't expose sensitive information

## API Endpoints

### Public Endpoints
- `GET /api/health` - Health check
- `POST /api/user/signup` - User registration
- `POST /api/user/login` - User login

### Protected Endpoints (Require JWT)
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `GET /api/user/validate-token` - Validate JWT token
- `POST /api/ai/*` - AI-powered features (workout, meals, coach)
- `POST /api/images/upload` - Upload profile images

## Testing

```bash
# Test the health endpoint
curl https://your-backend-url.com/api/health

# Test login
curl -X POST https://your-backend-url.com/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

## Rate Limits

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Authentication | 5 requests | 15 minutes |
| General API | 100 requests | 15 minutes |
| AI Features | 10 requests | 1 hour |

## Debugging

### Check Logs
- In production, logs are written to console
- Use your hosting provider's log viewer
- Look for error codes: `TOKEN_EXPIRED`, `INVALID_TOKEN`, etc.

### Common Issues

1. **CORS Errors:**
   - Ensure FRONTEND_URL is set correctly
   - Check that your frontend origin is in allowedOrigins

2. **Database Connection:**
   - Verify DATABASE_URL is correct
   - Ensure SSL is enabled for production databases

3. **JWT Issues:**
   - Check JWT_SECRET is set
   - Verify token expiration (JWT_EXPIRES_IN)

## Updates

After making changes:

```bash
# If schema changed
npx prisma migrate dev
npx prisma generate

# Commit and push
git add .
git commit -m "Your changes"
git push origin main

# Redeploy (automatic on most platforms)
```

## Support

For issues or questions:
1. Check the logs for detailed error messages
2. Verify environment variables are set correctly
3. Test with the health endpoint first
4. Use development mode locally for debugging

## License

ISC
