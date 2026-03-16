// import CredentialsProvider from 'next-auth/providers/credentials';
// import bcrypt from 'bcryptjs';
// import * as Sentry from '@sentry/nextjs';
// import dbConnect from '@/lib/dbConnect';
// import User from '@/models/User';
// import { checkRateLimit } from '@/lib/rateLimit';
// import { logger } from '@/lib/logger';
// import { writeAuditLog } from '@/lib/audit';

// function getAuthClientIp(reqLike) {
//   const forwarded = reqLike?.headers?.['x-forwarded-for'];
//   if (typeof forwarded === 'string' && forwarded.length > 0) {
//     return forwarded.split(',')[0].trim();
//   }

//   return reqLike?.headers?.['x-real-ip'] || 'unknown';
// }

// export const authOptions = {
//   providers: [
//     CredentialsProvider({
//       name: 'Credentials',
//       credentials: {
//         email: { label: 'Email', type: 'text' },
//         password: { label: 'Password', type: 'password' }
//       },
//       async authorize(credentials, req) {
//         if (!credentials?.email || !credentials?.password) {
//           return null;
//         }

//         const email = credentials.email.toLowerCase().trim();
//         const ip = getAuthClientIp(req);

//         const byIp = await checkRateLimit(`auth:ip:${ip}`, { windowMs: 60_000, max: 30 });
//         const byEmail = await checkRateLimit(`auth:email:${email}`, { windowMs: 60_000, max: 10 });

//         if (!byIp.allowed || !byEmail.allowed) {
//           logger.warn('auth_rate_limited', { ip, email });
//           return null;
//         }

//         try {
//           await dbConnect();
//           const user = await User.findOne({ email });

//           if (!user) {
//             return null;
//           }

//           if (user.isActive === false) {
//             logger.warn('auth_user_inactive', { email, ip });
//             return null;
//           }

//           const requireVerified = String(process.env.REQUIRE_EMAIL_VERIFICATION || 'false') === 'true';
//           if (requireVerified && !user.emailVerifiedAt) {
//             logger.warn('auth_email_unverified', { email, ip });
//             return null;
//           }

//           // const isValid = await bcrypt.compare(credentials.password, user.password);
//           // if (!isValid) {
//           //   return null;
//           // }
//           const isValid = await bcrypt.compare(credentials.password, user.password);
// console.log('=== AUTH DEBUG ===');
// console.log('email:', email);
// console.log('password entered:', credentials.password);
// console.log('hash in db:', user.password);
// console.log('isValid:', isValid);
// console.log('isActive:', user.isActive);
// console.log('emailVerifiedAt:', user.emailVerifiedAt);
// console.log('==================');
// if (!isValid) {
//   return null;
// }

//           return {
//             id: user._id.toString(),
//             name: user.name,
//             email: user.email,
//             role: user.role
//           };
//         } catch (error) {
//           logger.error('authorize_failed', { error: error.message, email, ip });
//           Sentry.captureException(error, {
//             tags: { scope: 'authorize' },
//             extra: { email, ip }
//           });
//           return null;
//         }
//       }
//     })
//   ],
//   callbacks: {
//     async jwt({ token, user }) {
//       if (user) {
//         token.id = user.id;
//         token.role = user.role;
//       }

//       return token;
//     },
//     async session({ session, token }) {
//       if (session?.user && token) {
//         session.user.id = token.id;
//         session.user.role = token.role;
//       }

//       return session;
//     }
//   },
//   pages: {
//     signIn: '/auth/signin'
//   },
//   session: {
//     strategy: 'jwt',
//     maxAge: 60 * 60 * 8,
//     updateAge: 60 * 30
//   },
//   jwt: {
//     maxAge: 60 * 60 * 8
//   },
//   cookies: {
//     sessionToken: {
//       name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
//       options: {
//         httpOnly: true,
//         sameSite: 'lax',
//         path: '/',
//         secure: process.env.NODE_ENV === 'production'
//       }
//     }
//   },
//   events: {
//     async signIn(message) {
//       await writeAuditLog(
//         {
//           headers: message?.request?.headers || {},
//           socket: { remoteAddress: 'unknown' }
//         },
//         {
//           actorUser: message.user?.id || null,
//           action: 'auth.sign_in',
//           targetType: 'User',
//           targetId: message.user?.id || null,
//           metadata: { provider: message.account?.provider || 'credentials' }
//         }
//       );
//     }
//   },
//   secret: process.env.NEXTAUTH_SECRET
// };


import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import * as Sentry from '@sentry/nextjs';
import dbConnect from '@/lib/dbConnect';
import User from '@/models/User';
import { checkRateLimit } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';
import { writeAuditLog } from '@/lib/audit';

function getAuthClientIp(reqLike) {
  const forwarded = reqLike?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return reqLike?.headers?.['x-real-ip'] || 'unknown';
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email.toLowerCase().trim();
        const ip = getAuthClientIp(req);

        try {
          await dbConnect();

          const byIp = await checkRateLimit(`auth:ip:${ip}`, { windowMs: 60_000, max: 30 });
          const byEmail = await checkRateLimit(`auth:email:${email}`, { windowMs: 60_000, max: 10 });

          if (!byIp.allowed || !byEmail.allowed) {
            logger.warn('auth_rate_limited', { ip, email });
            return null;
          }

          const user = await User.findOne({ email });
          console.log('=== AUTH DEBUG ===');
          console.log('user found:', user?.email);

          if (!user) {
            console.log('FAIL: user not found');
            return null;
          }

          if (user.isActive === false) {
            console.log('FAIL: user inactive');
            logger.warn('auth_user_inactive', { email, ip });
            return null;
          }

          const requireVerified = String(process.env.REQUIRE_EMAIL_VERIFICATION || 'false') === 'true';
          console.log('requireVerified:', requireVerified, 'emailVerifiedAt:', user.emailVerifiedAt);
          if (requireVerified && !user.emailVerifiedAt) {
            console.log('FAIL: email not verified');
            logger.warn('auth_email_unverified', { email, ip });
            return null;
          }

          const isValid = await bcrypt.compare(credentials.password, user.password);
          console.log('isValid:', isValid);
          console.log('==================');

          if (!isValid) {
            console.log('FAIL: wrong password');
            return null;
          }

          return {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role
          };
        } catch (error) {
          console.error('AUTH ERROR:', error.message);
          logger.error('authorize_failed', { error: error.message, email, ip });
          Sentry.captureException(error, {
            tags: { scope: 'authorize' },
            extra: { email, ip }
          });
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user && token) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth/signin'
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 8,
    updateAge: 60 * 30
  },
  jwt: {
    maxAge: 60 * 60 * 8
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    }
  },
  events: {
    async signIn(message) {
      await writeAuditLog(
        {
          headers: message?.request?.headers || {},
          socket: { remoteAddress: 'unknown' }
        },
        {
          actorUser: message.user?.id || null,
          action: 'auth.sign_in',
          targetType: 'User',
          targetId: message.user?.id || null,
          metadata: { provider: message.account?.provider || 'credentials' }
        }
      );
    }
  },
  secret: process.env.NEXTAUTH_SECRET
};
