// auth
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const LocalStrategy = require('passport-local');
const passport = require('passport');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const bcrypt = require('bcryptjs');
const _ = require('lodash');

const APP_SECRET_KEY = 'secret';
/** Asynchronously compares the given data against the given hash. */
const comparePassword = promisify(bcrypt.compare);
/** Asynchronously generates a hash for the given password. */
const hashPassword = async password => bcrypt.hash(password, await bcrypt.genSalt(10));
/** sign the given payload into a JSON Web Token */
const generateAuthToken = user => {
  return jwt.sign(
    {
      sub: user.id,
      aud: user.role,
      iat: Date.now()
    },
    APP_SECRET_KEY,
    { expiresIn: '20d' }
  );
};

/** authenticate endpoints using a JSON web token. */
const requireAuthHeader = passport.authenticate('jwt', { session: false });
/** authenticate using a username and password */
const requireAuthBody = passport.authenticate('local', { session: false });

const clearUserSensitiveData = user => _.pick(user, ['id', 'name', 'email']);

const handleAuth = (app, router) => {
  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: APP_SECRET_KEY
      },
      (payload, done) => {
        // See if the user ID in the payload exists in our database
        // If it does, call 'done' with that other
        // otherwise, call done without a user object
        try {
          const user = router.db.read().get('users').find({ id: payload.sub }).value();

          if (user) done(null, user);
          else done(null, false);
        } catch (err) {
          return done(err, false);
        }
      }
    )
  );

  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      // Verify this email and password, call done with the user
      // if it is the correct email and password
      // otherwise, call done with false
      try {
        const user = router.db.get('users').find({ email }).value();
        if (!user) return done(null, false);
        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) return done(null, false);
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  app.get('/profile', requireAuthHeader, (req, res) => res.send(clearUserSensitiveData(req.user)));

  app.post('/login', requireAuthBody, (req, res) => {
    // User has already had their email and password auth
    // We just need to give them a token
    res.setHeader('Authorization', generateAuthToken(req.user));
    res.send(clearUserSensitiveData(req.user));
  });

  app.post('/register', async (req, res) => {
    const { email, password } = req.body;

    const usersLowDB = router.db.read().get('users');

    if (!email || !password) {
      return res.status(422).send({ error: 'You must provide email and password' });
    }

    let user = await usersLowDB.find({ email }).value();
    if (user) return res.status(400).jsonp('the email address already in use');

    user = { ...req.body, id: uuidv4(), password: await hashPassword(password) };
    await usersLowDB.push(user).write();

    res.setHeader('Authorization', generateAuthToken(user));
    res.send(user);
  });
};

module.exports = {
  hashPassword,
  requireAuthHeader,
  requireAuthBody,
  handleAuth
};
