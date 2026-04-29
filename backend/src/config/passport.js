'use strict';

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const { authService } = require('../modules/auth/auth.service');
const logger = require('../shared/utils/logger');

// Validate environment variables for OAuth
const requiredEnv = [
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL',
  'MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET', 'MICROSOFT_CALLBACK_URL'
];
const missingEnv = requiredEnv.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
  const errorMsg = `WARNING: Missing OAuth environment variables: ${missingEnv.join(', ')}. Social login will be disabled.`;
  logger.warn(errorMsg);
}

// Only initialize Google strategy if variables are present
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const provider = 'google';
        const user = await authService.socialLogin({ email, name, provider, req });
        return done(null, user);
      } catch (error) {
        logger.error('Google OAuth Strategy Error:', error.message);
        return done(error, null);
      }
    }
  ));
}

// Only initialize Microsoft strategy if variables are present
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  passport.use(new MicrosoftStrategy({
      clientID: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      callbackURL: process.env.MICROSOFT_CALLBACK_URL,
      scope: ['user.read'],
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const provider = 'microsoft';
        const user = await authService.socialLogin({ email, name, provider, req });
        return done(null, user);
      } catch (error) {
        logger.error('Microsoft OAuth Strategy Error:', error.message);
        return done(error, null);
      }
    }
  ));
}

// Simple serialize/deserialize since we're using JWT-based stateless auth
// and only using Passport for the OAuth handshake
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  done(null, { id });
});

module.exports = passport;
